from __future__ import annotations

from pathlib import Path

from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parent.parent
SOURCE_PATH = PROJECT_ROOT / "assets" / "icons" / "source" / "app-icon-source.png"
PNG_OUTPUT_PATH = PROJECT_ROOT / "assets" / "icons" / "app-icon.png"
ICO_OUTPUT_PATH = PROJECT_ROOT / "assets" / "icons" / "app-icon.ico"

TARGET_PNG_SIZE = 1024
TARGET_ICO_SIZES = [256, 128, 64, 48, 32, 24, 16]


def main() -> None:
    if not SOURCE_PATH.exists():
        raise FileNotFoundError(f"Icon source not found: {SOURCE_PATH}")

    PNG_OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(SOURCE_PATH) as image:
        prepared = prepare_icon(image)
        prepared.save(PNG_OUTPUT_PATH, format="PNG")
        prepared.save(
            ICO_OUTPUT_PATH,
            format="ICO",
            sizes=[(size, size) for size in TARGET_ICO_SIZES],
        )

    print(f"Prepared icon PNG: {PNG_OUTPUT_PATH}")
    print(f"Prepared icon ICO: {ICO_OUTPUT_PATH}")


def prepare_icon(image: Image.Image) -> Image.Image:
    image = image.convert("RGBA")
    if image.width == image.height:
        return image.resize((TARGET_PNG_SIZE, TARGET_PNG_SIZE), Image.Resampling.LANCZOS)

    canvas_size = max(image.width, image.height)
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    offset_x = round((canvas_size - image.width) / 2)
    offset_y = round((canvas_size - image.height) / 2)
    canvas.alpha_composite(image, (offset_x, offset_y))

    return canvas.resize((TARGET_PNG_SIZE, TARGET_PNG_SIZE), Image.Resampling.LANCZOS)


if __name__ == "__main__":
    main()
