"""
HealthSaathi AI - Image Preprocessing Module
Uses Pillow (PIL) to prepare images (uploaded or rendered from PDF pages) for OCR.

Protects against:
  - Decompression bombs (max pixels safety limit)
  - EXIF orientation mismatches (phone camera scans)
  - Color space anomalies (RGBA, CMYK, P modes)
  - Extreme dimensions (excessive memory or illegibly low resolution)
  - Faint contrast on scanned medical reports / laboratory tables

Guarantees:
  - Operates strictly on in-memory working copies (never alters original input)
  - Preserves critical clinical markings: decimal points (e.g. 0.5 mg), negative signs (-),
    reference units, and table borders through conservative contrast enhancement.
"""

import sys
from typing import Optional, Tuple
from PIL import Image, ImageOps, ImageEnhance, UnidentifiedImageError

# Safeguard against decompression bomb attacks (50 Megapixels max)
Image.MAX_IMAGE_PIXELS = 50_000_000

MIN_TARGET_DIMENSION = 1200
MAX_TARGET_DIMENSION = 4000


class ImageProcessingError(Exception):
    """Base exception for image processing errors."""
    pass


class CorruptImageError(ImageProcessingError):
    """Raised when an image cannot be parsed or is corrupted."""
    pass


class ImageDimensionExceededError(ImageProcessingError):
    """Raised when image exceeds maximum allowable dimensions or pixel limit."""
    pass


def load_image_safely(file_path_or_bytes) -> Image.Image:
    """
    Safely load an image from a file path or file-like object with decompression limits.
    """
    try:
        img = Image.open(file_path_or_bytes)
        img.load()  # Force reading image data to detect truncation or corruption early
        return img
    except Image.DecompressionBombError as e:
        raise ImageDimensionExceededError(f"Image rejected: pixel count exceeds safety threshold: {e}") from e
    except (UnidentifiedImageError, OSError) as e:
        raise CorruptImageError(f"Failed to open or decode image: {e}") from e


def preprocess_image_for_ocr(
    raw_img: Image.Image,
    enhance_contrast: bool = True,
    contrast_factor: float = 1.35,
    target_dpi: int = 300,
) -> Image.Image:
    """
    Preprocess an image for Tesseract OCR.
    
    Returns a new, preprocessed PIL Image instance in grayscale ('L') mode.
    """
    # 1. Work on a copy to ensure immutability of input
    img = raw_img.copy()

    # 2. Correct EXIF orientation (essential for phone-camera photos of prescriptions/reports)
    try:
        img = ImageOps.exif_transpose(img)
    except Exception as e:
        sys.stderr.write(f"[image_processor] Note: EXIF transpose skipped: {e}\n")

    # 3. Normalize color modes to Grayscale ('L')
    # If image has an alpha channel (RGBA, LA), composite over white background to prevent dark artifacts
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        alpha = img.convert("RGBA")
        background = Image.new("RGBA", alpha.size, (255, 255, 255, 255))
        composite = Image.alpha_composite(background, alpha)
        img = composite.convert("L")
    elif img.mode != "L":
        img = img.convert("L")

    # 4. Check and normalize dimensions
    width, height = img.size
    max_side = max(width, height)
    min_side = min(width, height)

    # If the image is excessively large (> MAX_TARGET_DIMENSION on longest side), downscale
    if max_side > MAX_TARGET_DIMENSION:
        scale_ratio = MAX_TARGET_DIMENSION / float(max_side)
        new_width = int(width * scale_ratio)
        new_height = int(height * scale_ratio)
        img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        sys.stderr.write(f"[image_processor] Downscaled image from {width}x{height} to {new_width}x{new_height}\n")
    # If the image is low-resolution (< MIN_TARGET_DIMENSION on longest side), upscale
    # This significantly improves Tesseract's character segmentation for small medical fonts
    elif max_side < MIN_TARGET_DIMENSION and min_side > 100:
        scale_ratio = MIN_TARGET_DIMENSION / float(max_side)
        new_width = int(width * scale_ratio)
        new_height = int(height * scale_ratio)
        img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        sys.stderr.write(f"[image_processor] Upscaled low-res image from {width}x{height} to {new_width}x{new_height}\n")

    # 5. Conservative contrast enhancement
    # Mild contrast boost darkens faint printed text without clipping decimal points or thin table lines
    if enhance_contrast and contrast_factor > 1.0:
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(contrast_factor)

    # 6. Auto-contrast normalization to stretch the histogram safely
    try:
        # Cut off bottom 1% and top 1% outliers to maximize dynamic range of text vs background
        img = ImageOps.autocontrast(img, cutoff=1)
    except Exception as e:
        sys.stderr.write(f"[image_processor] Note: Autocontrast skipped: {e}\n")

    return img
