"""
LLM-powered report generation service.
Generates complete HTML reports using AI (Gemini/OpenAI) with embedded images.
"""
import base64
from pathlib import Path
from datetime import datetime
from typing import Optional

from app.core.config import settings


def image_to_data_url(image_path: str) -> str:
    """Convert image file to base64 data URL."""
    from PIL import Image
    import io
    
    img = Image.open(image_path).convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def build_prompt_for_report(
    project_name: str,
    scale_ft: float,
    scale_px: float,
    regions: list[dict],
    totals: dict,
) -> str:
    """Build prompt for LLM to generate HTML report."""
    
    # Build regions table data
    regions_data = []
    for r in regions:
        regions_data.append({
            "region": r["label"],
            "material": r.get("material_name", "Not selected"),
            "area_sqft": f"{r['area_sqft']:.0f}",
            "quantity": f"{r.get('quantity', 0):,.0f} {r.get('unit', '')}",
            "material_cost": f"₹{r['material_cost']:,.0f}",
            "labor_cost": f"₹{r['labor_cost']:,.0f}",
            "total_cost": f"₹{r['total_cost']:,.0f}",
        })
    
    prompt = f"""You are an expert HTML report generator for RenovaAI home renovation system.

PROJECT DETAILS:
- Name: {project_name}
- Reference: {scale_ft} ft = {scale_px} px
- Regions: {len(regions)}
- Date: {datetime.now().strftime("%d %b %Y, %I:%M %p")}

COST SUMMARY:
- Material: ₹{totals['material']:,.0f}
- Labor: ₹{totals['labor']:,.0f}
- TOTAL: ₹{totals['grand_total']:,.0f}

REGIONS:
{regions_data}

REQUIREMENTS:
1. Complete HTML document (<!DOCTYPE html> to </html>)
2. Embedded CSS (professional, print-friendly)
3. "Before & After Renovation" section with:
   - Grid layout (50% 50%)
   - Left side: <img id="original-image" src="#" alt="Original" />
   - Right side: <img id="generated-image" src="#" alt="AI Renovation" />
   - Use id="original-image" and id="generated-image" so images can be injected later
4. Cost breakdown table with all regions
5. AI Analysis:
   - Summary (2-3 sentences)
   - Cost assessment
   - 3-4 recommendations
6. Professional design (blue/gray color scheme)
7. Print-ready
8. Disclaimer: "Estimates are indicative"

STYLE:
- Clean, modern
- Side-by-side images
- Readable fonts
- Proper spacing
- Border-radius on images
- Mobile responsive

IMPORTANT: Use id="original-image" and id="generated-image" for the img tags.
The actual image data URLs will be injected after generation.

Generate COMPLETE HTML with placeholder src="#" for images.
"""
    
    return prompt


def generate_report_with_gemini(
    project_name: str,
    scale_ft: float,
    scale_px: float,
    regions: list[dict],
    totals: dict,
    original_image_path: str,
    generated_image_path: Optional[str],
) -> Optional[str]:
    """Generate HTML report using Gemini AI."""
    if not settings.gemini_api_key:
        
        return None
    
    try:
        from google import genai
        from google.genai import types
        
        client = genai.Client(api_key=settings.gemini_api_key)
        
        # Build prompt (WITHOUT images to avoid quota issues)
        prompt = build_prompt_for_report(
            project_name,
            scale_ft,
            scale_px,
            regions,
            totals,
        )
        
        # Generate report with Gemini
        response = client.models.generate_content(
            model="gemini-3.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=8192,
            )
        )
        
        if not response or not response.text:
            return None
            
        html = response.text
        
        # Clean up markdown code blocks if present
        if "```html" in html:
            html = html.split("```html")[1].split("```")[0].strip()
        elif "```" in html:
            html = html.split("```")[1].split("```")[0].strip()
        
        # Convert images to data URLs
        
        original_data_url = image_to_data_url(original_image_path)
        
        generated_data_url = None
        if generated_image_path:
            try:
                generated_data_url = image_to_data_url(generated_image_path)
            except Exception as e:
                pass
        # Inject actual image data URLs into HTML
        html = html.replace('id="original-image" src="#"', f'id="original-image" src="{original_data_url}"')
        html = html.replace('src="#" id="original-image"', f'src="{original_data_url}" id="original-image"')
        
        if generated_data_url:
            html = html.replace('id="generated-image" src="#"', f'id="generated-image" src="{generated_data_url}"')
            html = html.replace('src="#" id="generated-image"', f'src="{generated_data_url}" id="generated-image"')
        
        
        return html
    
    except Exception as e:
        
        import traceback
        traceback.print_exc()
        return None


def generate_report_with_openai(
    project_name: str,
    scale_ft: float,
    scale_px: float,
    regions: list[dict],
    totals: dict,
    original_image_path: str,
    generated_image_path: Optional[str],
) -> Optional[str]:
    """Generate HTML report using OpenAI as fallback."""
    if not settings.openai_api_key:
        return None
    
    try:
        from openai import OpenAI
        
        client = OpenAI(api_key=settings.openai_api_key)
        
        # Build prompt (WITHOUT images to avoid token limits)
        prompt = build_prompt_for_report(
            project_name,
            scale_ft,
            scale_px,
            regions,
            totals,
        )
        
        # Generate report with OpenAI
        
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # Using mini for lower cost
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert HTML report generator. Generate complete, valid HTML documents."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.3,
            max_tokens=8192
        )
        
        if not response.choices or not response.choices[0].message:
            
            return None
            
        html = response.choices[0].message.content
        
        # Clean up markdown code blocks if present
        if "```html" in html:
            html = html.split("```html")[1].split("```")[0].strip()
        elif "```" in html:
            html = html.split("```")[1].split("```")[0].strip()
        
        # Convert images to data URLs
        
        original_data_url = image_to_data_url(original_image_path)
        
        generated_data_url = None
        if generated_image_path:
            try:
                generated_data_url = image_to_data_url(generated_image_path)
            except Exception as e:
                pass
        # Inject actual image data URLs into HTML
        html = html.replace('id="original-image" src="#"', f'id="original-image" src="{original_data_url}"')
        html = html.replace('src="#" id="original-image"', f'src="{original_data_url}" id="original-image"')
        
        if generated_data_url:
            html = html.replace('id="generated-image" src="#"', f'id="generated-image" src="{generated_data_url}"')
            html = html.replace('src="#" id="generated-image"', f'src="{generated_data_url}" id="generated-image"')
        
        
        return html
    
    except Exception as e:
        
        import traceback
        traceback.print_exc()
        return None


def generate_llm_report(
    project_name: str,
    scale_ft: float,
    scale_px: float,
    regions: list[dict],
    totals: dict,
    original_image_path: str,
    generated_image_path: Optional[str],
) -> str:
    """
    Generate HTML report using LLM (Gemini primary, OpenAI fallback).
    Raises HTTPException if both fail.
    """
    # Try Gemini first
    html = generate_report_with_gemini(
        project_name, scale_ft, scale_px, regions, totals,
        original_image_path, generated_image_path
    )
    
    if html:
        return html
    
    # Fallback to OpenAI
    html = generate_report_with_openai(
        project_name, scale_ft, scale_px, regions, totals,
        original_image_path, generated_image_path
    )
    
    if html:
        return html
    
    # Both failed - return error message
    from fastapi import HTTPException
    raise HTTPException(
        status_code=503,
        detail="📊 **Report Generation Unavailable**\n\nBoth Gemini and OpenAI are unavailable. Please:\n- Check your API keys\n- Ensure you have available quota\n- Try again in a few moments"
    )
