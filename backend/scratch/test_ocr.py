import re

PHONE_PATTERN = re.compile(r"(?:\+91|91)?([6-9]\d{9})")


def clean_extracted_name(line: str) -> str:
    # Remove the phone number
    cleaned = PHONE_PATTERN.sub("", line).strip()
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


# Test cases representing typical raw OCR lines from printed/handwritten registers
test_cases = [
    "1. Sunita Devi - 9876543210",
    "सुनीता देवी 919876543210 Bagbera",
    "03) Babita Kumari (Age 32) - 9988776655",
    "9999999999 Pinky Singh",
    "12. REKHA DEVI - +918888888888",
    "रेखा देवी 9888888888 (बगबेरा)",
]

print("Running OCR name cleaning test cases:")
for tc in test_cases:
    cleaned = clean_extracted_name(tc)
    print(f"Raw: {tc!r} => Cleaned: {cleaned!r}")
