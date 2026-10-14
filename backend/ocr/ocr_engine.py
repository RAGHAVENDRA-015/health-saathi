"""
HealthSaathi AI - OCR Engine
Invokes native Tesseract OCR executable via pytesseract.
Configurable via environment variables or function parameters:
  - TESSERACT_CMD: path to tesseract binary (default: searches PATH)
  - TESSERACT_LANG: language codes (default: 'eng')
  - TESSERACT_TIMEOUT: execution timeout in seconds (default: 30)
"""

import os
import shutil
import sys
from typing import Dict, Any, Optional
from PIL import Image
import pytesseract


class OcrError(Exception):
    """Base exception for OCR engine errors."""
    pass


class TesseractNotFoundError(OcrError):
    """Raised when the native Tesseract binary cannot be located or executed."""
    pass


class LanguageNotAvailableError(OcrError):
    """Raised when the requested Tesseract language pack is not installed."""
    pass


class OcrTimeoutError(OcrError):
    """Raised when Tesseract execution exceeds the configured timeout."""
    pass


def get_tesseract_cmd() -> str:
    """Resolve the Tesseract binary path."""
    env_cmd = os.environ.get("TESSERACT_CMD")
    if env_cmd:
        if os.path.isfile(env_cmd) and os.access(env_cmd, os.X_OK):
            return env_cmd
        raise TesseractNotFoundError(f"Configured TESSERACT_CMD is not executable: {env_cmd}")

    cmd = shutil.which("tesseract")
    if not cmd:
        for candidate in ["/opt/homebrew/bin/tesseract", "/usr/local/bin/tesseract", "/usr/bin/tesseract"]:
            if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
                cmd = candidate
                break

    if not cmd:
        raise TesseractNotFoundError(
            "Tesseract executable not found on system PATH or Homebrew locations. "
            "Please install Tesseract (e.g. `brew install tesseract` or `apt-get install tesseract-ocr`) "
            "or configure TESSERACT_CMD."
        )
    return cmd


def configure_tesseract(tesseract_cmd: Optional[str] = None) -> None:
    """Configure pytesseract with the resolved binary command."""
    cmd = tesseract_cmd or get_tesseract_cmd()
    pytesseract.pytesseract.tesseract_cmd = cmd


def check_language_available(lang: str) -> bool:
    """Verify if the requested language is installed in Tesseract's tessdata directory."""
    try:
        available_langs = pytesseract.get_languages()
        # For composite languages e.g. "eng+hin", check each sub-language
        requested_langs = [l.strip() for l in lang.split("+")]
        for r_lang in requested_langs:
            if r_lang and r_lang not in available_langs:
                return False
        return True
    except Exception as e:
        sys.stderr.write(f"[ocr_engine] Warning checking languages: {e}\n")
        # If check fails to list languages, fallback to permissive so execution can still attempt
        return True


def run_ocr(
    image: Image.Image,
    lang: str = "eng",
    psm: int = 3,
    timeout_sec: int = 30
) -> Dict[str, Any]:
    """
    Run Tesseract OCR on a PIL Image.
    
    Args:
        image: Prepared PIL Image instance
        lang: Tesseract language code (default 'eng')
        psm: Page segmentation mode (default 3: Fully automatic page segmentation)
        timeout_sec: Per-image timeout in seconds
        
    Returns:
        Dict with keys:
          - text: Extracted plain text
          - confidence: Average confidence score (0-100) or None
          - word_count: Number of words detected
    """
    configure_tesseract()

    if not check_language_available(lang):
        raise LanguageNotAvailableError(
            f"Tesseract language '{lang}' is not installed in tessdata. "
            f"Available languages: {pytesseract.get_languages()}"
        )

    config = f"--psm {psm}"

    try:
        # Run text extraction with timeout
        raw_text = pytesseract.image_to_string(
            image,
            lang=lang,
            config=config,
            timeout=timeout_sec
        )
    except RuntimeError as e:
        err_msg = str(e).lower()
        if "timeout" in err_msg:
            raise OcrTimeoutError(f"Tesseract OCR timed out after {timeout_sec}s") from e
        raise OcrError(f"Tesseract OCR execution failed: {e}") from e

    # Extract structured word data for confidence metric calculation
    confidence: Optional[float] = None
    try:
        data = pytesseract.image_to_data(
            image,
            lang=lang,
            config=config,
            timeout=timeout_sec,
            output_type=pytesseract.Output.DICT
        )
        conf_values = [
            float(c) for c in data.get("conf", [])
            if c != -1 and str(c).strip() != "" and float(c) >= 0
        ]
        if conf_values:
            confidence = round(sum(conf_values) / len(conf_values), 2)
    except Exception as e:
        sys.stderr.write(f"[ocr_engine] Note: Confidence extraction skipped: {e}\n")

    cleaned_text = raw_text.strip()
    words = [w for w in cleaned_text.split() if w]

    return {
        "text": cleaned_text,
        "confidence": confidence,
        "word_count": len(words),
        "char_count": len(cleaned_text),
    }
