#!/usr/bin/env python3
"""Generate visually faithful, mobile-friendly WebP variants of the approved stele."""
from pathlib import Path
from io import BytesIO
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
ORIGINAL = ROOT / "assets/path/story-stele.webp"
MAX_MOBILE_BYTES = 500 * 1024

def export_variant(width: int, limit: int, initial_quality: int) -> tuple[int, int]:
    with Image.open(ORIGINAL) as image:
        image = ImageOps.exif_transpose(image)
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
        if image.width < width:
            raise ValueError(f"Original width {image.width} is less than requested {width}")
        height = round(image.height * width / image.width)
        resized = image.resize((width, height), Image.Resampling.LANCZOS)
        for quality in range(initial_quality, 43, -4):
            buffer = BytesIO()
            resized.save(buffer, format="WEBP", quality=quality, method=6)
            if len(buffer.getvalue()) <= limit:
                destination = ORIGINAL.with_name(f"story-stele-{width}.webp")
                destination.write_bytes(buffer.getvalue())
                print(f"{destination.relative_to(ROOT)} {width}x{height}: {len(buffer.getvalue())} bytes @ quality {quality}")
                return width, len(buffer.getvalue())
        raise ValueError(f"Cannot produce stele-{width}.webp at <= {limit} bytes without excessive quality loss")

def main() -> None:
    if not ORIGINAL.is_file():
        raise FileNotFoundError(ORIGINAL)
    with Image.open(ORIGINAL) as original:
        print(f"Original approved stele: {original.width}x{original.height}, {ORIGINAL.stat().st_size} bytes")
    export_variant(640, MAX_MOBILE_BYTES, 80)
    export_variant(932, 1200 * 1024, 82)

if __name__ == "__main__":
    main()
