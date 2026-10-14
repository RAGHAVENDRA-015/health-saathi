"""
HealthSaathi AI - OCR & Document Intelligence Test Suite
Tests PyMuPDF, Pillow preprocessing, Tesseract OCR, mixed PDFs, limits, and error handling.
Uses synthetic documents (no real patient data or external network calls).
"""

import os
import sys
import tempfile
import pytest
from PIL import Image, ImageDraw, ImageFont
import fitz  # PyMuPDF

# Add backend directory to sys.path
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from ocr.ocr_engine import run_ocr, configure_tesseract
from ocr.image_processor import (
    preprocess_image_for_ocr,
    load_image_safely,
    CorruptImageError,
    ImageDimensionExceededError,
)
from ocr.pdf_processor import (
    process_pdf,
    is_usable_digital_text,
    InvalidPdfError,
    EncryptedPdfError,
    MaxPagesExceededError,
)


@pytest.fixture(autouse=True)
def ensure_tesseract():
    configure_tesseract()


def create_synthetic_image(text: str, size=(800, 300), bg="white", fg="black") -> Image.Image:
    """Create a crisp synthetic image with specified text for OCR testing."""
    img = Image.new("RGB", size, color=bg)
    draw = ImageDraw.Draw(img)
    # Draw simple readable text
    draw.text((40, 60), text, fill=fg)
    return img


def test_pillow_preprocessing_and_tesseract_ocr():
    """Verify Pillow image preparation and Tesseract text extraction on a synthetic image."""
    test_text = "Fasting Blood Sugar: 95 mg/dL\nHbA1c: 5.6%"
    raw_img = create_synthetic_image(test_text, size=(1000, 400))

    preprocessed = preprocess_image_for_ocr(raw_img)
    assert preprocessed.mode == "L", "Preprocessed image must be in grayscale mode"
    assert preprocessed.size[0] >= 1000

    result = run_ocr(preprocessed, lang="eng", psm=3)
    assert "text" in result
    extracted = result["text"]
    # Check that key clinical numbers and words are extracted
    assert "Blood" in extracted or "Sugar" in extracted or "95" in extracted or "HbA1c" in extracted
    assert result["word_count"] > 0
    assert result["confidence"] is not None
    assert result["confidence"] > 50


def test_corrupt_image_handling():
    """Verify CorruptImageError is raised when reading malformed/corrupt image bytes."""
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
        f.write(b"NOT_A_VALID_PNG_DATA_HEADER_CORRUPT")
        temp_path = f.name

    try:
        with pytest.raises(CorruptImageError):
            load_image_safely(temp_path)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


def test_digital_pdf_extraction_skips_ocr():
    """Verify digital PDFs with sufficient embedded text use direct extraction without OCR."""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        pdf_path = f.name

    try:
        # Create a digital PDF with PyMuPDF
        doc = fitz.open()
        page = doc.new_page(width=595, height=842)
        digital_content = (
            "PATIENT CLINICAL SUMMARY REPORT\n"
            "Patient Name: John Doe\n"
            "Date: 2026-10-12\n"
            "Blood Pressure: 120/80 mmHg\n"
            "Heart Rate: 72 bpm\n"
            "Assessment: Routine health evaluation within normal reference limits."
        )
        page.insert_text((50, 72), digital_content, fontsize=12)
        doc.save(pdf_path)
        doc.close()

        result = process_pdf(pdf_path, max_pages=10)
        assert result["success"] is True
        assert result["documentType"] == "pdf"
        assert result["pageCount"] == 1
        assert len(result["pages"]) == 1

        first_page = result["pages"][0]
        assert first_page["method"] == "embedded_text", "Digital page must not trigger OCR"
        assert "Blood Pressure: 120/80" in result["extractedText"]
        assert result["metadata"]["ocrPagesCount"] == 0
        assert result["metadata"]["embeddedPagesCount"] == 1

    finally:
        if os.path.exists(pdf_path):
            os.remove(pdf_path)


def test_scanned_pdf_selective_ocr():
    """Verify that a scanned PDF page (containing an embedded image with no digital text) triggers OCR."""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        pdf_path = f.name

    try:
        # Create an image containing clinical text
        img = create_synthetic_image("Serum Creatinine: 0.9 mg/dL\neGFR: 92 mL/min", size=(900, 300))
        img_byte_arr = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        img.save(img_byte_arr.name, format="PNG")

        # Create PDF and insert the image as a full-page scan (no digital text)
        doc = fitz.open()
        page = doc.new_page(width=600, height=300)
        page.insert_image(page.rect, filename=img_byte_arr.name)
        doc.save(pdf_path)
        doc.close()

        os.remove(img_byte_arr.name)

        result = process_pdf(pdf_path, max_pages=10, dpi=150)
        assert result["success"] is True
        assert result["pageCount"] == 1
        first_page = result["pages"][0]
        assert first_page["method"] == "ocr", "Scanned image page must trigger OCR"
        assert result["metadata"]["ocrPagesCount"] == 1
        assert result["metadata"]["embeddedPagesCount"] == 0
        assert "Creatinine" in result["extractedText"] or "0.9" in result["extractedText"] or "mg/dL" in result["extractedText"]

    finally:
        if os.path.exists(pdf_path):
            os.remove(pdf_path)


def test_mixed_pdf_preserves_order_and_methods():
    """
    Verify mixed PDFs with both digital-text pages and scanned image pages:
      - Page 1: Digital text -> embedded_text
      - Page 2: Scanned image -> ocr
      - Page order is strictly preserved.
    """
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        pdf_path = f.name

    try:
        doc = fitz.open()

        # Page 1: Digital Text
        p1 = doc.new_page(width=600, height=400)
        p1_text = "Page 1 Digital Header: Annual Wellness Checkup\nPrescription: Metformin 500mg daily with meals."
        p1.insert_text((50, 50), p1_text, fontsize=12)

        # Page 2: Scanned Image
        p2 = doc.new_page(width=600, height=400)
        img = create_synthetic_image("Page 2 Lab Scan: Total Cholesterol: 185 mg/dL", size=(800, 300))
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as temp_img:
            img.save(temp_img.name, format="PNG")
            p2.insert_image(p2.rect, filename=temp_img.name)
            os.remove(temp_img.name)

        doc.save(pdf_path)
        doc.close()

        result = process_pdf(pdf_path, max_pages=10, dpi=150)
        assert result["success"] is True
        assert result["pageCount"] == 2

        assert result["pages"][0]["pageNumber"] == 1
        assert result["pages"][0]["method"] == "embedded_text"
        assert "Metformin 500mg" in result["pages"][0]["text"]

        assert result["pages"][1]["pageNumber"] == 2
        assert result["pages"][1]["method"] == "ocr"

        assert result["metadata"]["embeddedPagesCount"] == 1
        assert result["metadata"]["ocrPagesCount"] == 1

        # Check full combined text contains markers in order
        extracted = result["extractedText"]
        idx_p1 = extracted.find("Page 1")
        idx_p2 = extracted.find("Page 2")
        assert idx_p1 != -1 and idx_p2 != -1
        assert idx_p1 < idx_p2, "Page 1 content must appear before Page 2 in combined output"

    finally:
        if os.path.exists(pdf_path):
            os.remove(pdf_path)


def test_encrypted_pdf_detection():
    """Verify EncryptedPdfError is raised when trying to process a password-protected PDF."""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        pdf_path = f.name

    try:
        doc = fitz.open()
        p = doc.new_page()
        p.insert_text((50, 50), "Confidential Patient Record")
        # Save encrypted with user password
        doc.save(
            pdf_path,
            encryption=fitz.PDF_ENCRYPT_AES_256,
            user_pw="securepassword123",
            owner_pw="ownerpass456"
        )
        doc.close()

        with pytest.raises(EncryptedPdfError):
            process_pdf(pdf_path, max_pages=10)

    finally:
        if os.path.exists(pdf_path):
            os.remove(pdf_path)


def test_max_pages_enforcement():
    """Verify MaxPagesExceededError is raised when a PDF exceeds configured page budget."""
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        pdf_path = f.name

    try:
        doc = fitz.open()
        for i in range(5):
            p = doc.new_page()
            p.insert_text((50, 50), f"Page {i+1}")
        doc.save(pdf_path)
        doc.close()

        # Enforce max 3 pages
        with pytest.raises(MaxPagesExceededError):
            process_pdf(pdf_path, max_pages=3)

    finally:
        if os.path.exists(pdf_path):
            os.remove(pdf_path)
