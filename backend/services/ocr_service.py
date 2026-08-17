import io
import logging
import os
import re

from PIL import Image

logger = logging.getLogger(__name__)


class OCRService:
    """
    Extracts ASHA worker names and phone numbers from photos.
    Supports:
    - Physical register photos
    - WhatsApp group screenshots
    - Excel sheet photos
    - Printed roster photos
    """

    PHONE_PATTERN = re.compile(r"(?:\+91|91)?([6-9]\d{9})")
    # Match strings containing English/Hindi alphabetical characters of length 2-30
    NAME_PATTERN = re.compile(r"[A-Za-z\u0900-\u097F][A-Za-z\u0900-\u097F\s]{2,30}")

    def extract_from_image(self, image_bytes: bytes) -> list[dict]:
        """
        Returns list of: {name, phone, confidence, raw_text}
        confidence: "high" | "medium" | "low"
        """
        if os.environ.get("GOOGLE_VISION_API_KEY"):
            try:
                return self._extract_with_google_vision(image_bytes)
            except Exception as e:
                logger.error(f"Google Vision OCR failed, falling back: {e}")

        return self._extract_with_tesseract(image_bytes)

    def _extract_with_google_vision(self, image_bytes: bytes) -> list[dict]:
        """Google Cloud Vision API — best for handwritten registers."""
        from google.cloud import vision

        client = vision.ImageAnnotatorClient()
        image = vision.Image(content=image_bytes)
        response = client.text_detection(image=image)
        full_text = response.full_text_annotation.text
        return self._parse_text_to_workers(full_text)

    def _extract_with_tesseract(self, image_bytes: bytes) -> list[dict]:
        """Tesseract OCR — free, local, good for printed text."""
        import pytesseract

        image = Image.open(io.BytesIO(image_bytes))
        try:
            # Query available languages dynamically to avoid load failures and latency overhead
            langs = pytesseract.get_languages()
            if "hin" in langs and "eng" in langs:
                lang = "hin+eng"
            elif "eng" in langs:
                lang = "eng"
            else:
                lang = langs[0] if langs else "eng"
            text = pytesseract.image_to_string(image, lang=lang, config="--psm 6")
        except Exception as e:
            logger.warning(f"Tesseract dynamic lang load failed, trying default: {e}")
            text = pytesseract.image_to_string(image, config="--psm 6")

        return self._parse_text_to_workers(text)

    def _parse_text_to_workers(self, text: str) -> list[dict]:
        """
        Parses raw OCR text to extract name-phone pairs.
        Strategy: find phone numbers first, then find nearby names.
        """
        lines = [line.strip() for line in text.strip().split("\n") if line.strip()]
        results = []

        for i, line in enumerate(lines):
            phones = self.PHONE_PATTERN.findall(line)
            if not phones:
                continue

            phone = phones[0]  # Take the first matched phone number

            # Look for name: same line (removing the phone number), or previous/next lines
            name = self._find_name_near_line(lines, i)

            # Assign confidence based on name detection quality
            if name and len(name) > 3:
                confidence = "high"
            elif name:
                confidence = "medium"
            else:
                confidence = "low"

            results.append(
                {
                    "phone": phone,
                    "name": name or "",
                    "confidence": confidence,
                    "raw_text": line,
                }
            )

        return results

    def _clean_name(self, text: str) -> str:
        """Cleans name of serial numbers, phone numbers, ages, and formatting symbols."""
        # Remove the phone number if present
        cleaned = self.PHONE_PATTERN.sub("", text).strip()
        # Remove leading digits and symbols (like serial numbers "1. ", "10- ")
        cleaned = re.sub(r"^\d+\s*[\.\-\)\s]*", "", cleaned)
        # Remove trailing digits/ages (like " 35")
        cleaned = re.sub(r"[\s\.\-\(]+\d+$", "", cleaned)
        # Strip age-related words (e.g. "Age", "yrs", "उम्र", "वर्ष") case-insensitively
        cleaned = re.sub(r"\b(age|yrs|yr|years|year|उम्र|वर्ष|साल)\b", "", cleaned, flags=re.IGNORECASE)
        # Remove any other numbers or underscores
        cleaned = re.sub(r"[0-9_]+", "", cleaned)
        # Remove special chars but keep spaces and Hindi characters
        cleaned = re.sub(r"[^\w\s\u0900-\u097F]", "", cleaned)
        # Collapse multiple spaces
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        return cleaned[:50]

    def _find_name_near_line(self, lines: list[str], phone_line_idx: int) -> str:
        """Find a name near the phone number line."""
        # 1. Check same line (common in roster sheets/WhatsApp rows)
        line = lines[phone_line_idx]
        cleaned = self._clean_name(line)
        if len(cleaned) > 2:
            return cleaned

        # 2. Check previous line
        if phone_line_idx > 0:
            prev = lines[phone_line_idx - 1].strip()
            prev_cleaned = self._clean_name(prev)
            if len(prev_cleaned) > 2 and not self.PHONE_PATTERN.search(prev):
                return prev_cleaned

        # 3. Check next line
        if phone_line_idx < len(lines) - 1:
            nxt = lines[phone_line_idx + 1].strip()
            nxt_cleaned = self._clean_name(nxt)
            if len(nxt_cleaned) > 2 and not self.PHONE_PATTERN.search(nxt):
                return nxt_cleaned

        return ""
