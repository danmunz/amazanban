#!/usr/bin/env python3
"""Regenerates extension/icons/*.png: three orange Kanban bars on a dark tile.

The 128px and 48px icons follow the Chrome Web Store rule of 96/128 artwork with
transparent padding. The 16px and 32px toolbar icons fill the frame so they stay
legible at that size.

Requires Pillow (pip install pillow).
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "extension" / "icons"
ART = 512  # artwork is drawn at this size, then scaled
BG = (19, 25, 33, 255)  # Amazon nav navy
BAR = (255, 153, 0)  # Amazon orange
BARS = [(0.92, 255), (0.62, 225), (0.78, 195)]  # (height fraction, alpha)


def tile():
    im = Image.new("RGBA", (ART, ART), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([0, 0, ART - 1, ART - 1], radius=118, fill=BG)
    width, gap, top = 92, 36, 104
    x0 = (ART - (3 * width + 2 * gap)) // 2
    max_h = ART - 2 * top
    for i, (frac, alpha) in enumerate(BARS):
        x = x0 + i * (width + gap)
        d.rounded_rectangle([x, top, x + width, top + int(max_h * frac)], radius=24, fill=BAR + (alpha,))
    return im


def padded(art, size, pad_ratio=16 / 128):
    """Places the artwork inside `size` with transparent padding and a faint
    white glow so the dark tile reads on dark backgrounds."""
    canvas = ART * 2
    pad = int(canvas * pad_ratio)
    inner = canvas - 2 * pad
    big = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))

    mask = art.resize((inner, inner), Image.LANCZOS).split()[3]
    glow = Image.new("RGBA", (canvas, canvas), (255, 255, 255, 0))
    glow_mask = Image.new("L", (canvas, canvas), 0)
    glow_mask.paste(mask, (pad, pad))
    glow_mask = glow_mask.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(10))
    glow.putalpha(glow_mask.point(lambda v: v * 50 // 255))
    big.alpha_composite(glow)
    big.alpha_composite(art.resize((inner, inner), Image.LANCZOS), (pad, pad))
    return big.resize((size, size), Image.LANCZOS)


def main():
    art = tile()
    OUT.mkdir(parents=True, exist_ok=True)
    for n in (128, 48):
        padded(art, n).save(OUT / f"icon{n}.png")
    for n in (32, 16):
        padded(art, n, pad_ratio=1 / 32).save(OUT / f"icon{n}.png")
    print(f"Wrote icons to {OUT}")


if __name__ == "__main__":
    main()
