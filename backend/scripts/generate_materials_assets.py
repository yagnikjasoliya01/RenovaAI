import math
import os
import random
from pathlib import Path

from PIL import Image, ImageDraw

SIZE = 256
SEED = 42

ROOT = Path(__file__).resolve().parents[1]
TEXTURES = ROOT / "app" / "materials" / "textures"
THUMBS = ROOT / "app" / "materials" / "thumbs"


def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c)


def grain(img, sigma=5, scale=6, alpha=0.15):
    n = Image.effect_noise((SIZE // scale, SIZE // scale), sigma)
    n = n.resize((SIZE, SIZE), Image.BILINEAR).convert("RGB")
    return Image.blend(img, n, alpha)


def paint(base, streaks=18, alpha=0.08):
    img = Image.new("RGB", (SIZE, SIZE), base)
    d = ImageDraw.Draw(img)
    rnd = random.Random(SEED)
    for _ in range(streaks):
        x = rnd.randrange(SIZE)
        d.rectangle([x, 0, x + 1, SIZE], fill=shade(base, rnd.uniform(0.97, 1.03)))
    return grain(img, 4, alpha=alpha)


def stone_grain(base):
    img = Image.new("RGB", (SIZE, SIZE), base)
    d = ImageDraw.Draw(img)
    rnd = random.Random(SEED)
    for _ in range(2600):
        x, y = rnd.randrange(SIZE), rnd.randrange(SIZE)
        d.point(
            (x, y),
            fill=rnd.choice(
                [shade(base, 0.8), shade(base, 0.9), shade(base, 1.15), shade(base, 1.28)]
            ),
        )
    return grain(img, 6, scale=4, alpha=0.22)


def granite(base):
    img = Image.new("RGB", (SIZE, SIZE), base)
    d = ImageDraw.Draw(img)
    rnd = random.Random(SEED)
    colors = [shade(base, 0.4), shade(base, 0.62), shade(base, 0.85), shade(base, 1.18), (250, 250, 250)]
    for _ in range(1700):
        x, y = rnd.randrange(SIZE), rnd.randrange(SIZE)
        r = rnd.choice([1, 1, 1, 2])
        d.ellipse([x, y, x + r, y + r], fill=rnd.choice(colors))
    return grain(img, 5, alpha=0.1)


def marble(base):
    img = Image.new("RGB", (SIZE, SIZE), base)
    d = ImageDraw.Draw(img)
    rnd = random.Random(SEED)
    for _ in range(46):
        x = rnd.randrange(-SIZE, 2 * SIZE)
        y = rnd.randrange(SIZE)
        amp = rnd.uniform(4, 20)
        step = rnd.uniform(4, 11)
        freq = rnd.uniform(0.02, 0.08)
        pts = []
        px = x
        while px < x + int(SIZE * 1.2):
            pts.append((px, y + math.sin(px * freq) * amp + rnd.uniform(-2, 2)))
            px += step
        d.line(
            pts,
            fill=mix(shade(base, rnd.uniform(0.45, 0.8)), (210, 210, 220), rnd.random()),
            width=rnd.choice([1, 1, 2]),
        )
    return grain(img, 4, alpha=0.1)


def slate(base):
    img = Image.new("RGB", (SIZE, SIZE), base)
    d = ImageDraw.Draw(img)
    rnd = random.Random(SEED)
    for _ in range(1000):
        x, y = rnd.randrange(SIZE), rnd.randrange(SIZE)
        r = rnd.choice([1, 1, 2])
        d.ellipse([x, y, x + r, y + r], fill=rnd.choice([shade(base, 0.6), shade(base, 1.25), (10, 12, 16)]))
    for _ in range(16):
        y = rnd.randrange(SIZE)
        x = 0
        while x < SIZE:
            d.line(
                [(x, y), (x + rnd.randint(20, 55), y + rnd.choice([0, 0, 1, -1]))],
                fill=(18, 20, 26),
                width=1,
            )
            x += rnd.randint(30, 75)
    return grain(img, 7, scale=4, alpha=0.25)


def brick(base, mortar=(219, 201, 186)):
    img = Image.new("RGB", (SIZE, SIZE), mortar)
    d = ImageDraw.Draw(img)
    rnd = random.Random(SEED)
    bw, bh, gap = 42, 16, 4
    row = 0
    y = 0
    while y < SIZE:
        offset = (bw // 2) * (row % 2)
        x = -offset
        while x < SIZE:
            d.rectangle(
                [x + 1, y + 1, x + bw - 1, y + bh - 1],
                fill=shade(base, rnd.uniform(0.9, 1.08)),
            )
            x += bw + gap
        y += bh + gap
        row += 1
    return grain(img, 7, alpha=0.12)


def tile_grid(base, cols, rows, grout=(0.66), gloss=False):
    img = Image.new("RGB", (SIZE, SIZE), shade(base, grout))
    d = ImageDraw.Draw(img)
    rnd = random.Random(SEED)
    tw, th = SIZE // cols, SIZE // rows
    for cx in range(cols):
        for ry in range(rows):
            x, y = cx * tw, ry * th
            d.rectangle(
                [x + 2, y + 2, x + tw - 2, y + th - 2],
                fill=shade(base, rnd.uniform(0.93, 1.07)),
            )
    if gloss:
        for cx in range(cols):
            for ry in range(rows):
                x, y = cx * tw, ry * th
                d.line(
                    [(x + tw * 0.25, y + th * 0.1), (x + tw * 0.5, y + th * 0.55)],
                    fill=(255, 255, 255),
                    width=2,
                )
    return grain(img, 4, alpha=0.1)


def wood(base):
    img = Image.new("RGB", (SIZE, SIZE), base)
    d = ImageDraw.Draw(img)
    rnd = random.Random(SEED)
    y = 0
    while y < SIZE:
        h = rnd.randint(2, 6)
        band = shade(base, rnd.uniform(0.72, 1.18))
        d.rectangle([0, y, SIZE, y + h], fill=band)
        if rnd.random() < 0.7:
            d.line([(0, y + h // 2), (SIZE, y + h // 2)], fill=shade(band, 0.72), width=1)
        y += h
    for _ in range(4):
        kx, ky = rnd.randrange(SIZE), rnd.randrange(SIZE)
        for r in range(5, 0, -1):
            d.ellipse(
                [kx - r, ky - r // 2, kx + r, ky + r // 2],
                outline=shade(base, 0.55 + (5 - r) * 0.09),
                width=2,
            )
    return grain(img, 5, alpha=0.12)


def brushed(base, dark=0.72, hi=1.28):
    img = Image.new("RGB", (SIZE, SIZE), base)
    d = ImageDraw.Draw(img)
    rnd = random.Random(SEED)
    x = 0
    while x < SIZE:
        d.rectangle([x, 0, x, SIZE], fill=shade(base, rnd.uniform(dark, hi)))
        x += rnd.randint(1, 3)
    for _ in range(3):
        y = rnd.randrange(SIZE)
        for x in range(0, SIZE, 3):
            d.line([(x, y), (x + 2, y)], fill=shade(base, rnd.uniform(1.15, 1.5)), width=1)
    return img


def glass(base):
    img = Image.new("RGB", (SIZE, SIZE), base)
    d = ImageDraw.Draw(img)
    rnd = random.Random(SEED)
    for _ in range(34):
        x = rnd.randrange(-SIZE, 2 * SIZE)
        y = rnd.randrange(-SIZE // 2, SIZE)
        ln = rnd.randint(40, 150)
        d.line([(x, y), (x + ln, y + ln)], fill=(255, 255, 255), width=rnd.choice([1, 2, 3]))
    return grain(img, 5, alpha=0.12)


def wrought(base):
    img = Image.new("RGB", (SIZE, SIZE), base)
    d = ImageDraw.Draw(img)
    rnd = random.Random(SEED)
    for _ in range(1000):
        x, y = rnd.randrange(SIZE), rnd.randrange(SIZE)
        d.point((x, y), fill=rnd.choice([shade(base, 0.8), shade(base, 1.3)]))
    for _ in range(9):
        cx, cy = rnd.randrange(SIZE), rnd.randrange(SIZE)
        r0 = rnd.randint(6, 14)
        for r in range(r0, r0 + 10):
            d.arc(
                [cx - r, cy - r, cx + r, cy + r],
                rnd.randint(0, 360),
                rnd.randint(0, 360) + 200,
                fill=shade(base, rnd.uniform(0.5, 0.92)),
                width=1,
            )
    return img


def plaster(base):
    img = Image.new("RGB", (SIZE, SIZE), base)
    d = ImageDraw.Draw(img)
    rnd = random.Random(SEED)
    for _ in range(50):
        x, y = rnd.randrange(SIZE), rnd.randrange(SIZE)
        r = rnd.randint(8, 22)
        d.ellipse([x, y, x + r, y + r], fill=shade(base, rnd.uniform(0.88, 1.12)))
    return grain(img, 9, alpha=0.25)


def pvc(base):
    img = Image.new("RGB", (SIZE, SIZE), base)
    d = ImageDraw.Draw(img)
    rnd = random.Random(SEED)
    for _ in range(60):
        x = rnd.randrange(SIZE)
        d.rectangle([x, 0, x, SIZE], fill=shade(base, rnd.uniform(0.96, 1.04)))
    return grain(img, 3, alpha=0.08)


def acp(base):
    img = Image.new("RGB", (SIZE, SIZE), base)
    d = ImageDraw.Draw(img)
    rnd = random.Random(SEED)
    for _ in range(4):
        y = rnd.randrange(SIZE)
        d.line([(0, y), (SIZE, y)], fill=shade(base, 0.82), width=1)
    return grain(img, 4, alpha=0.12)


def mix(c1, c2, t):
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))


def hex_to_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


GENERATORS = {
    "texture_paint_acrylic": lambda: paint(hex_to_rgb("#E8E2D4")),
    "texture_paint_texture": lambda: stone_grain(hex_to_rgb("#C6BAA0")),
    "texture_paint_matt_finish": lambda: paint(hex_to_rgb("#D9D2C3")),
    "texture_paint_heat_reflective": lambda: paint(hex_to_rgb("#E6EFE9")),
    "texture_paint_custom": lambda: paint(hex_to_rgb("#E8E2D4"), alpha=0.05),
    "texture_cladding_granite": lambda: granite(hex_to_rgb("#B9B7B3")),
    "texture_cladding_kota": lambda: granite(hex_to_rgb("#9AA59A")),
    "texture_cladding_brick": lambda: brick(hex_to_rgb("#B5482E")),
    "texture_cladding_slate": lambda: slate(hex_to_rgb("#4B525C")),
    "texture_cladding_marble": lambda: marble(hex_to_rgb("#F0EEE8")),
    "texture_tiles_ceramic": lambda: tile_grid(hex_to_rgb("#EAE3D4"), 4, 6, gloss=True),
    "texture_tiles_vitrified": lambda: tile_grid(hex_to_rgb("#D8C9A6"), 6, 6, gloss=True),
    "texture_tiles_terracotta": lambda: tile_grid(hex_to_rgb("#C0643C"), 4, 6),
    "texture_panels_wood": lambda: wood(hex_to_rgb("#9A6B3F")),
    "texture_panels_pvc": lambda: pvc(hex_to_rgb("#EDEDEA")),
    "texture_panels_acp": lambda: acp(hex_to_rgb("#D6D6D3")),
    "texture_railing_metal": lambda: brushed(hex_to_rgb("#6E7278")),
    "texture_railing_stainless": lambda: brushed(hex_to_rgb("#CBD0D6"), dark=0.82, hi=1.3),
    "texture_railing_glass": lambda: glass(hex_to_rgb("#BFDCE8")),
    "texture_railing_wrought": lambda: wrought(hex_to_rgb("#2B2B2F")),
    "texture_plaster_finish": lambda: plaster(hex_to_rgb("#D8D1C4")),
}


def main():
    TEXTURES.mkdir(parents=True, exist_ok=True)
    THUMBS.mkdir(parents=True, exist_ok=True)
    for name, gen in GENERATORS.items():
        img = gen().resize((SIZE, SIZE), Image.LANCZOS)
        img.save(TEXTURES / f"{name}.png")
        thumb = img.resize((128, 128), Image.LANCZOS)
        thumb.save(THUMBS / f"thumb_{name[len('texture_'):]}.png")
        print("wrote", name)


if __name__ == "__main__":
    main()
