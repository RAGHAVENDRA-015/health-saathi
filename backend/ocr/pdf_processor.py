"""
HealthSaathi AI - PDF Processing Module
Uses PyMuPDF (`fitz`) for PDF parsing, selective text extraction, and page rendering.

Highlights:
  1. Safe opening and encryption detection (password-protected PDFs)
  2. Page-count bounds enforcement (protects against denial of service)
  3. Selective OCR: extracts embedded digital text directly when usable,
     rendering and running OCR *only* on scanned / image-only pages.
  4. Preserves page order, page numbers, extraction methods, and per-page metrics.
"""

import sys
import io
from typing import Dict, Any, List, Optional
import fitz  # PyMuPDF
from PIL import Image

from .image_processor import preprocess_image_for_ocr
from .ocr_engine import run_ocr, OcrError


class PdfProcessingError(Exception):
    """Base exception for PDF processing."""
    pass


class InvalidPdfError(PdfProcessingError):
    """Raised when the file is not a valid PDF."""
    pass


class EncryptedPdfError(PdfProcessingError):
    """Raised when the PDF is password-protected or encrypted."""
    pass


class MaxPagesExceededError(PdfProcessingError):
    """Raised when PDF page count exceeds configured limit."""
    pass


# A digital page is considered to have usable text if it contains at least this many
# non-whitespace characters and reasonable word structure
MIN_DIGITAL_TEXT_CHARS = 50


def is_usable_digital_text(text: str) -> bool:
    """
    Determine if the extracted embedded text is sufficient and usable,
    or if the page is essentially scanned / empty and requires OCR.
    """
    stripped = text.strip()
    non_ws_len = len("".join(stripped.split()))
    if non_ws_len < MIN_DIGITAL_TEXT_CHARS:
        return False
    # Check if there are at least several recognizable words
    words = [w for w in stripped.split() if len(w) > 1]
    return len(words) >= 5


def process_pdf(
    file_path: str,
    max_pages: int = 500,
    dpi: int = 200,
    lang: str = "eng",
    ocr_timeout_sec: int = 30
) -> Dict[str, Any]:
    """
    Process a PDF file end-to-end:
      - Extracts digital text on text-native pages.
      - Selectively renders and OCRs image-heavy/scanned pages.
      - Maintains original page ordering and metadata.
    """
    try:
        doc = fitz.open(file_path)
    except Exception as e:
        raise InvalidPdfError(f"Cannot open PDF document: {e}") from e

    try:
        # Check encryption / password protection
        if doc.is_encrypted or doc.needs_pass:
            raise EncryptedPdfError("The PDF document is password-protected or encrypted.")

        page_count = len(doc)
        if page_count == 0:
            raise InvalidPdfError("PDF document has 0 pages.")

        if page_count > max_pages:
            raise MaxPagesExceededError(
                f"PDF has {page_count} pages, which exceeds the maximum allowed ({max_pages} pages)."
            )

        pages_result: List[Dict[str, Any]] = []
        combined_text_parts: List[str] = []
        ocr_pages_count = 0
        embedded_pages_count = 0
        total_ocr_confidence = 0.0

        for page_idx in range(page_count):
            page_num = page_idx + 1
            page = doc.load_page(page_idx)

            # Step 1: Attempt digital embedded text extraction
            embedded_text = page.get_text("text") or ""
            normalized_embedded = embedded_text.strip()

            if is_usable_digital_text(normalized_embedded):
                # Page has rich embedded text — skip OCR
                embedded_pages_count += 1
                words = [w for w in normalized_embedded.split() if w]
                page_meta = {
                    "pageNumber": page_num,
                    "method": "embedded_text",
                    "text": normalized_embedded,
                    "charCount": len(normalized_embedded),
                    "wordCount": len(words),
                    "confidence": None,
                    "success": True,
                }
                pages_result.append(page_meta)
                combined_text_parts.append(f"--- Page {page_num} ---\n{normalized_embedded}")
                sys.stderr.write(f"[pdf_processor] Page {page_num}: Extracted digital text ({len(normalized_embedded)} chars)\n")
            else:
                # Page is scanned, has minimal or no digital text — render and OCR
                ocr_pages_count += 1
                sys.stderr.write(f"[pdf_processor] Page {page_num}: Little or no digital text. Rendering page for OCR @ {dpi} DPI...\n")

                try:
                    # Render page to pixmap
                    pix = page.get_pixmap(dpi=dpi)
                    # Convert to PIL Image
                    mode = "RGBA" if pix.alpha else "RGB"
                    raw_img = Image.frombytes(mode, [pix.width, pix.height], pix.samples)

                    # Pillow preprocessing
                    preprocessed_img = preprocess_image_for_ocr(raw_img)

                    # Tesseract OCR
                    ocr_res = run_ocr(
                        preprocessed_img,
                        lang=lang,
                        psm=3,
                        timeout_sec=ocr_timeout_sec
                    )

                    ocr_text = ocr_res["text"]
                    conf = ocr_res.get("confidence")
                    if conf is not None:
                        total_ocr_confidence += conf

                    page_meta = {
                        "pageNumber": page_num,
                        "method": "ocr",
                        "text": ocr_text,
                        "charCount": len(ocr_text),
                        "wordCount": ocr_res["word_count"],
                        "confidence": conf,
                        "success": True,
                    }
                    pages_result.append(page_meta)
                    combined_text_parts.append(f"--- Page {page_num} (OCR) ---\n{ocr_text}")
                    sys.stderr.write(f"[pdf_processor] Page {page_num}: OCR completed ({len(ocr_text)} chars, conf={conf})\n")

                except (OcrError, Exception) as e:
                    sys.stderr.write(f"[pdf_processor] ❌ Error running OCR on page {page_num}: {e}\n")
                    page_meta = {
                        "pageNumber": page_num,
                        "method": "ocr",
                        "text": normalized_embedded,  # fallback to whatever partial text existed
                        "charCount": len(normalized_embedded),
                        "wordCount": len(normalized_embedded.split()),
                        "confidence": None,
                        "success": False,
                        "error": str(e),
                    }
                    pages_result.append(page_meta)
                    combined_text_parts.append(f"--- Page {page_num} [Extraction Warning] ---\n{normalized_embedded}")

        # Compute summary metrics
        full_text = "\n\n".join(combined_text_parts).strip()
        total_words = len([w for w in full_text.split() if w])
        avg_confidence = (
            round(total_ocr_confidence / ocr_pages_count, 2)
            if ocr_pages_count > 0 and total_ocr_confidence > 0
            else None
        )

        return {
            "success": True,
            "documentType": "pdf",
            "pageCount": page_count,
            "extractedText": full_text,
            "pages": pages_result,
            "metadata": {
                "totalChars": len(full_text),
                "totalWords": total_words,
                "ocrPagesCount": ocr_pages_count,
                "embeddedPagesCount": embedded_pages_count,
                "avgOcrConfidence": avg_confidence,
            },
        }

    finally:
        doc.close()
