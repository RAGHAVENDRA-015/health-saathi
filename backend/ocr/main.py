"""
HealthSaathi AI - CLI OCR Worker Entrypoint
Invoked by the Node.js background worker using child_process with argument arrays.

Rules:
  - All logs and diagnostics write strictly to sys.stderr.
  - Exactly one JSON payload is emitted to sys.stdout.
  - Safe error handling returns machine-readable error codes.
"""

import sys
import os
import json
import time
import argparse
from typing import Dict, Any

# Ensure current package can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ocr.ocr_engine import (
    run_ocr,
    TesseractNotFoundError,
    LanguageNotAvailableError,
    OcrTimeoutError,
    OcrError,
)
from ocr.image_processor import (
    load_image_safely,
    preprocess_image_for_ocr,
    CorruptImageError,
    ImageDimensionExceededError,
)
from ocr.pdf_processor import (
    process_pdf,
    InvalidPdfError,
    EncryptedPdfError,
    MaxPagesExceededError,
)


def emit_json(payload: Dict[str, Any]) -> None:
    """Serialize and write strictly JSON to sys.stdout."""
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def process_image_file(
    file_path: str,
    lang: str = "eng",
    ocr_timeout_sec: int = 30
) -> Dict[str, Any]:
    """Process a single image file (PNG/JPEG) through Pillow + Tesseract."""
    raw_img = load_image_safely(file_path)
    preprocessed_img = preprocess_image_for_ocr(raw_img)

    ocr_res = run_ocr(
        preprocessed_img,
        lang=lang,
        psm=3,
        timeout_sec=ocr_timeout_sec
    )

    text = ocr_res["text"]
    conf = ocr_res.get("confidence")
    words = [w for w in text.split() if w]

    return {
        "success": True,
        "documentType": "image",
        "pageCount": 1,
        "extractedText": text,
        "pages": [
            {
                "pageNumber": 1,
                "method": "ocr",
                "text": text,
                "charCount": len(text),
                "wordCount": len(words),
                "confidence": conf,
                "success": True,
            }
        ],
        "metadata": {
            "totalChars": len(text),
            "totalWords": len(words),
            "ocrPagesCount": 1,
            "embeddedPagesCount": 0,
            "avgOcrConfidence": conf,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="HealthSaathi AI Document OCR & Text Extractor")
    parser.add_argument("--input", required=True, help="Absolute path to input document")
    parser.add_argument("--mime-type", default=None, help="MIME type if known (e.g. application/pdf, image/png)")
    parser.add_argument("--max-pages", type=int, default=500, help="Maximum allowed pages for PDFs")
    parser.add_argument("--dpi", type=int, default=200, help="Rendering resolution DPI for PDF OCR")
    parser.add_argument("--lang", default="eng", help="Tesseract language code (default: eng)")
    parser.add_argument("--timeout", type=int, default=30, help="Per-page OCR timeout in seconds")

    args = parser.parse_args()
    input_path = os.path.abspath(args.input)

    start_time = time.time()

    if not os.path.exists(input_path):
        emit_json({
            "success": False,
            "errorCode": "FILE_NOT_FOUND",
            "errorMessage": f"Input file does not exist: {input_path}"
        })
        sys.exit(0)

    # Determine whether PDF or image
    is_pdf = False
    if args.mime_type:
        is_pdf = "pdf" in args.mime_type.lower()
    else:
        is_pdf = input_path.lower().endswith(".pdf")

    try:
        if is_pdf:
            sys.stderr.write(f"[main] Processing PDF document: {input_path}\n")
            result = process_pdf(
                file_path=input_path,
                max_pages=args.max_pages,
                dpi=args.dpi,
                lang=args.lang,
                ocr_timeout_sec=args.timeout,
            )
        else:
            sys.stderr.write(f"[main] Processing Image document: {input_path}\n")
            result = process_image_file(
                file_path=input_path,
                lang=args.lang,
                ocr_timeout_sec=args.timeout,
            )

        duration_ms = int((time.time() - start_time) * 1000)
        result["metadata"]["processingDurationMs"] = duration_ms
        emit_json(result)
        sys.exit(0)

    except EncryptedPdfError as e:
        emit_json({
            "success": False,
            "errorCode": "ENCRYPTED_PDF",
            "errorMessage": str(e),
        })
        sys.exit(0)

    except InvalidPdfError as e:
        emit_json({
            "success": False,
            "errorCode": "INVALID_PDF",
            "errorMessage": str(e),
        })
        sys.exit(0)

    except MaxPagesExceededError as e:
        emit_json({
            "success": False,
            "errorCode": "MAX_PAGES_EXCEEDED",
            "errorMessage": str(e),
        })
        sys.exit(0)

    except CorruptImageError as e:
        emit_json({
            "success": False,
            "errorCode": "CORRUPT_IMAGE",
            "errorMessage": str(e),
        })
        sys.exit(0)

    except ImageDimensionExceededError as e:
        emit_json({
            "success": False,
            "errorCode": "IMAGE_TOO_LARGE",
            "errorMessage": str(e),
        })
        sys.exit(0)

    except TesseractNotFoundError as e:
        emit_json({
            "success": False,
            "errorCode": "TESSERACT_NOT_FOUND",
            "errorMessage": str(e),
        })
        sys.exit(0)

    except LanguageNotAvailableError as e:
        emit_json({
            "success": False,
            "errorCode": "TESSERACT_LANG_MISSING",
            "errorMessage": str(e),
        })
        sys.exit(0)

    except OcrTimeoutError as e:
        emit_json({
            "success": False,
            "errorCode": "OCR_TIMEOUT",
            "errorMessage": str(e),
        })
        sys.exit(0)

    except Exception as e:
        sys.stderr.write(f"[main] Unexpected error: {e}\n")
        emit_json({
            "success": False,
            "errorCode": "PROCESSING_FAILED",
            "errorMessage": f"An unexpected error occurred during document extraction: {str(e)}",
        })
        sys.exit(0)


if __name__ == "__main__":
    main()
