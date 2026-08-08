"""Generates placeholder thumbnail + tileable texture images for each material."""
import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "app" / "materials"
TEXTURES = ASSETS / "textures"
THUMBS = ASSETS / "thumbs"
SIZE = 256

# material_id -> (base color, pattern)
PALETTE = {
    "paint_acrylic": ((222, 214, 196), "paint"),
    "paint_texture": ((198, 186, 160), "texture"),
    "paint_matt_finish": ((217, 210, 195), "paint"),
    "paint_heat_reflective": ((230, 239, 233), "paint"),
    "paint_custom": ((232, 226, 212), "paint"),
    "cladding_granite": ((150, 150, 152), "granite"),
    "cladding_kota": ((196, 194, 186), "stone"),
    "cladding_brick": ((168, 92, 78), "brick"),
    "cladding_slate": ((92, 96, 102), "granite"),
    "cladding_marble": ((238, 236, 232), "granite"),
    "tiles_ceramic": ((212, 224, 226), "tiles"),
    "tiles_vitrified": ((200, 206, 214), "tiles"),
    "tiles_terracotta": ((188, 108, 72), "tiles"),
    "panels_wood": ((146, 106, 70), "wood"),
    "panels_pvc": ((235, 235, 232), "stripes"),
    "panels_acp": ((205, 208, 214), "stripes"),
    "railing_metal": ((90, 94, 98), "bars"),
    "railing_stainless": ((196, 198, 202), "bars"),
    "railing_glass": ((198, 220, 232), "glass"),
    "railing_wrought": ((60, 62, 66), "bars"),
    "plaster_finish": ((238, 236, 228), "plaster"),
}

rng = random.Random(42)


def _wrap_noise(x, y, amount=14):
    return int(rng.uniform(-amount, amount)) if ((x * 31 + y * 17) % 7 == 0) else 0


def make_texture(material_id):
    base, pattern = PALETTE[material_id]
    img = Image.new("RGB", (SIZE, SIZE), base)
    d = ImageDraw.Draw(img)

    if pattern == "paint":
        px = img.load()
        for y in range(SIZE):
            for x in range(SIZE):
                n = _wrap_noise(x, y, 8)
                px[x, y] = tuple(max(0, min(255, c + n)) for c in base)
    elif pattern == "texture":
        for _ in range(2600):
            x, y = rng.randrange(SIZE), rng.randrange(SIZE)
            shade = int(rng.uniform(-25, 25))
            d.point((x, y), fill=tuple(max(0, min(255, c + shade)) for c in base))
    elif pattern == "granite":
        for _ in range(1600):
            x, y = rng.randrange(SIZE), rng.randrange(SIZE)
            shade = int(rng.uniform(-55, 55))
            d.point((x, y), fill=tuple(max(0, min(255, c + shade)) for c in base))
        for _ in range(60):
            x0, y0 = rng.randrange(SIZE), rng.randrange(SIZE)
            d.line(
                [(x0, y0), (x0 + rng.randint(-30, 30), y0 + rng.randint(-8, 8))],
                fill=(210, 205, 200),
                width=1,
            )
    elif pattern == "stone":
        block = 32
        for y in range(0, SIZE, block):
            for x in range(0, SIZE, block):
                shade = int(rng.uniform(-20, 20))
                d.rectangle(
                    [x + 2, y + 2, x + block - 3, y + block - 3],
                    fill=tuple(max(0, min(255, c + shade)) for c in base),
                )
    elif pattern == "tiles":
        tile = 64
        for y in range(0, SIZE, tile):
            for x in range(0, SIZE, tile):
                shade = int(rng.uniform(-14, 14))
                d.rectangle(
                    [x + 2, y + 2, x + tile - 2, y + tile - 2],
                    fill=tuple(max(0, min(255, c + shade)) for c in base),
                )
    elif pattern == "wood":
        for i in range(16):
            y = rng.randrange(SIZE)
            d.line([(0, y), (SIZE, y)], fill=tuple(int(c * 0.75) for c in base), width=rng.randint(1, 3))
    elif pattern == "stripes":
        for x in range(0, SIZE, 8):
            shade = -22 if (x // 8) % 2 else 12
            d.rectangle(
                [x, 0, x + 8, SIZE],
                fill=tuple(max(0, min(255, c + shade)) for c in base),
            )
    elif pattern == "bars":
        for x in range(0, SIZE, 12):
            d.rectangle(
                [x, 4, x + 6, SIZE - 4],
                fill=tuple(int(c * 0.7) for c in base),
            )
    elif pattern == "glass":
        grad = Image.new("L", (1, SIZE))
        for y in range(SIZE):
            grad.putpixel((0, y), int(200 + 40 * math.sin(y / 30)))
        img = Image.merge("RGB", (grad, grad, grad)).convert("RGB")
    elif pattern == "plaster":
        px = img.load()
        for y in range(SIZE):
            for x in range(SIZE):
                n = _wrap_noise(x, y, 4)
                px[x, y] = tuple(max(0, min(255, c + n)) for c in base)
    elif pattern == "brick":
        bh, bw = 20, 64
        for row in range(0, SIZE, bh):
            offset = (bw // 2) if (row // bh) % 2 else 0
            for x in range(-bw, SIZE, bw):
                shade = int(rng.uniform(-22, 22))
                d.rectangle(
                    [x + offset + 1, row + 1, x + offset + bw - 2, row + bh - 2],
                    fill=tuple(max(0, min(255, c + shade)) for c in base),
                )
    return img


def main():
    TEXTURES.mkdir(parents=True, exist_ok=True)
    THUMBS.mkdir(parents=True, exist_ok=True)
    catalog = json.loads((ROOT / "app" / "materials.json").read_text(encoding="utf-8"))
    for m in catalog:
        img = make_texture(m["id"])
        img.save(TEXTURES / m["texture"])
        thumb = ImageEnhance.Sharpness(img.resize((64, 64))).enhance(1.4)
        thumb.save(THUMBS / m["thumbnail"])
        print("generated", m["id"])


if __name__ == "__main__":
    main()
