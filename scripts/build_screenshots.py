"""Build display WebP pairs and lossless originals from user-provided screenshots."""
from pathlib import Path
import argparse
from PIL import Image, ImageOps

parser = argparse.ArgumentParser()
parser.add_argument("--source", type=Path, required=True)
parser.add_argument("--out", type=Path, default=Path(__file__).resolve().parents[1] / "public/screenshots/reading-edition")
args = parser.parse_args()

screenshots = {
    "discover": ("漫画首页", True),
    "reader": ("漫画阅读", False),
    "detail": ("漫画详情", True),
    "bookshelf": ("我的书架", True),
    "novels": ("轻小说首页", True),
    "novel-reader": ("轻小说阅读", True),
    "bookmarks": ("书签", True),
    "comments": ("章节评论", True),
    "desktop": ("漫画首页-横屏", True),
    "spread": ("漫画阅读-横屏", False),
}

args.out.mkdir(parents=True, exist_ok=True)
for name, (source_name, has_dark) in screenshots.items():
    variants = {}
    for suffix in ["", "-dark"] if has_dark else [""]:
        with Image.open(args.source / f"{source_name}{suffix}.png") as original:
            variants[suffix] = ImageOps.exif_transpose(original).convert("RGBA")
    size = (max(image.width for image in variants.values()), max(image.height for image in variants.values()))
    for suffix, original in variants.items():
        full = args.out / f"{name}{suffix}-full.webp"
        display = args.out / f"{name}{suffix}.webp"
        for target in [full, display]:
            if target.exists():
                with Image.open(target) as previous:
                    print(f"replace {target.name}: {previous.size}")
        original.save(full, "WEBP", lossless=True, method=6)
        # Keep the whole image. Only pad a shorter theme variant at the bottom.
        canvas = Image.new("RGBA", size, original.getpixel((0, original.height - 1)))
        canvas.paste(original, (0, 0))
        canvas.thumbnail((1200, 2400), Image.Resampling.LANCZOS)
        canvas.save(display, "WEBP", quality=86, method=6)
        print(f"{display.name}: {canvas.size}, {display.stat().st_size:,} bytes; original {original.size}")
    print(f"{name}: layout {size[0]} x {size[1]}")
