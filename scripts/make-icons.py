#!/usr/bin/env python3
"""Regenerates extension/icons/*.png: three orange Kanban bars on a dark tile.

Requires Pillow (pip install pillow).
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "extension" / "icons"
SIZE = 512
BG = (19, 25, 33, 255)  # Amazon nav navy
BAR = (255, 153, 0)  # Amazon orange
BARS = [(0.92, 255), (0.62, 225), (0.78, 195)]  # (height fraction, alpha)


def main():
    im = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([16, 16, SIZE - 16, SIZE - 16], radius=110, fill=BG)

    width, gap, top = 88, 34, 118
    x0 = (SIZE - (3 * width + 2 * gap)) // 2
    max_h = SIZE - 2 * top
    for i, (frac, alpha) in enumerate(BARS):
        x = x0 + i * (width + gap)
        d.rounded_rectangle([x, top, x + width, top + int(max_h * frac)], radius=22, fill=BAR + (alpha,))

    OUT.mkdir(parents=True, exist_ok=True)
    for n in (16, 32, 48, 128):
        im.resize((n, n), Image.LANCZOS).save(OUT / f"icon{n}.png")
    print(f"Wrote icons to {OUT}")


if __name__ == "__main__":
    main()
