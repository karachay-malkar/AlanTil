#!/usr/bin/env python3
"""Build square AlanTil browser icons from the existing mountain silhouette.

Preserves the original aspect ratio; no artwork generation or re-drawing.
Requires Pillow: python3 -m pip install Pillow
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "assets/icons/ui/path-elbrus-white.png"
TARGET = ROOT / "assets/icons/ui"
SIZES = (32, 192, 512)
BACKGROUND = (42, 43, 42, 255)


def main():
    with Image.open(SOURCE) as image:
        mountain = image.convert("RGBA")
    bounds = mountain.getbbox()
    if not bounds:
        raise ValueError("Original mountain image has no visible pixels")
    mountain = mountain.crop(bounds)
    width, height = mountain.size
    if not (2.5 <= width / height <= 3.5):
        raise ValueError(f"Unexpected source aspect ratio: {width}x{height}")

    # Generate in high resolution, then downsample for crisp 32 px rendering.
    base_size = 1024
    badge = Image.new("RGBA", (base_size, base_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(badge)
    margin = 28
    draw.ellipse((margin, margin, base_size - margin - 1, base_size - margin - 1), fill=BACKGROUND)
    icon_width = int(base_size * 0.78)
    icon_height = round(icon_width * height / width)
    resized = mountain.resize((icon_width, icon_height), Image.Resampling.LANCZOS)
    badge.alpha_composite(resized, ((base_size - icon_width) // 2, (base_size - icon_height) // 2))

    for size in SIZES:
        output = TARGET / f"favicon-{size}.png"
        image = badge.resize((size, size), Image.Resampling.LANCZOS)
        image.save(output, format="PNG", optimize=True)
        with Image.open(output) as test:
            assert test.size == (size, size) and test.mode == "RGBA"
        print(f"{output.relative_to(ROOT)}: {output.stat().st_size} bytes")


if __name__ == "__main__":
    main()
