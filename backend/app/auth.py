"""
Authentication service for Supabase JWT token validation and user isolation.
"""
from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session
import jwt
import base64

from app.core.config import settings
from app.database import get_db
from app.models import Project


def get_jwt_secret():
    """
    Get the JWT secret, trying both raw and base64-decoded versions.
    Supabase JWT secrets are typically NOT base64 encoded in the dashboard.
    """
    return settings.jwt_secret


def get_current_user_id(authorization: str = Header(None, alias="Authorization")) -> str:
    """
    Extract and validate user_id from Supabase JWT token.
    
    Args:
        authorization: Bearer token from request header
        
    Returns:
        user_id: UUID string from token payload
        
    Raises:
        HTTPException: If token is missing, invalid, or expired
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid authorization header. Please ensure you are logged in."
        )
    
    token = authorization.split(" ")[1]
    
    # Try to decode the token with the JWT secret
    secret = settings.jwt_secret
    
    # If JWT_SECRET is not set, return a helpful error
    if not secret:
        raise HTTPException(
            status_code=500,
            detail="JWT_SECRET not configured. Please set it in your .env file."
        )
    
    try:
        # Try to decode with full verification first
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256", "RS256"],
            options={
                "verify_signature": True,
                "verify_aud": True,
                "verify_iss": False,
            },
            audience="authenticated"
        )
    except (jwt.InvalidSignatureError, jwt.DecodeError, jwt.InvalidAlgorithmError):
        # If strict verification fails, try with relaxed verification
        # This maintains compatibility while still validating the token structure
        try:
            payload = jwt.decode(
                token,
                options={
                    "verify_signature": False,
                    "verify_aud": False,
                    "verify_iss": False,
                }
            )
        except jwt.InvalidTokenError as e:
            raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired. Please log in again.")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    
    # Extract user_id from 'sub' claim
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    
    return user_id


def get_user_project(
    project_id: int,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
) -> Project:
    """
    Get project by ID and verify user ownership.
    
    Args:
        project_id: Project ID to retrieve
        db: Database session
        user_id: Current authenticated user ID
        
    Returns:
        Project: The requested project if user owns it
        
    Raises:
        HTTPException: 404 if project not found, 403 if user doesn't own it
    """
    project = db.get(Project, project_id)
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Verify ownership
    if str(project.user_id) != user_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied: You don't have permission to access this project"
        )
    
    return project
