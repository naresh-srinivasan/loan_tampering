"""
Generates realistic sample bank-statement documents for local testing/demo:
- sample_clean.pdf: a single-generation "scanned" JPEG raster, internally consistent balances.
- sample_tampered.pdf: same document with one balance cell spliced in after the fact
  (white-out + re-typed text) before final compression, and the running balance
  broken - this is exactly the two independent signals (ELA + ledger math) the
  forensics pipeline is designed to catch.

Both are saved as single-page PDFs wrapping a JPEG image, simulating a photocopied/
scanned statement (which is what Error Level Analysis is actually designed to inspect -
a raw vector-text PDF has no prior compression generation for ELA to compare against).
"""
import io
import os
import fitz
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "sample_docs")
FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

W, H = 1240, 1600
COLS = [60, 300, 620, 780, 940, 1180]  # Date | Narration | Credit | Debit | Balance | (right edge)
ROWS = [
    ("01/01/2025", "Opening Balance", "", "", "50000.00"),
    ("03/01/2025", "Salary Credit", "45000.00", "", "95000.00"),
    ("05/01/2025", "Rent Payment", "", "15000.00", "80000.00"),
    ("10/01/2025", "Grocery Store", "", "3500.00", "76500.00"),
    ("15/01/2025", "EMI Auto Debit", "", "8000.00", "68500.00"),
    ("20/01/2025", "Utility Bill", "", "2200.00", "66300.00"),
    ("28/01/2025", "ATM Withdrawal", "", "5000.00", "61300.00"),
    ("03/02/2025", "Salary Credit", "45000.00", "", "106300.00"),
    ("05/02/2025", "Rent Payment", "", "15000.00", "91300.00"),
    ("15/02/2025", "EMI Auto Debit", "", "8000.00", "83300.00"),
]
ROW_HEIGHT = 44
TABLE_TOP = 180


def render_base_image() -> Image.Image:
    img = Image.new("RGB", (W, H), "white")
    draw = ImageDraw.Draw(img)
    title_font = ImageFont.truetype(FONT_BOLD_PATH, 28)
    header_font = ImageFont.truetype(FONT_BOLD_PATH, 18)
    cell_font = ImageFont.truetype(FONT_PATH, 17)

    draw.text((60, 60), "SAMPLE BANK - ACCOUNT STATEMENT", font=title_font, fill="black")
    draw.text((60, 110), "Account Holder: Naresh S   |   A/C No: XXXXXX4821", font=cell_font, fill="black")

    headers = ["Date", "Narration", "Credit", "Debit", "Balance"]
    y = TABLE_TOP
    for i, h in enumerate(headers):
        draw.text((COLS[i] + 5, y + 10), h, font=header_font, fill="white")
    draw.rectangle([COLS[0], y, COLS[-1], y + ROW_HEIGHT], fill="#2c3e50")
    for i, h in enumerate(headers):
        draw.text((COLS[i] + 5, y + 10), h, font=header_font, fill="white")

    y += ROW_HEIGHT
    for row in ROWS:
        for i, val in enumerate(row):
            draw.text((COLS[i] + 5, y + 12), val, font=cell_font, fill="black")
        y += ROW_HEIGHT
    for x in COLS:
        draw.line([(x, TABLE_TOP), (x, y)], fill="gray")
    yy = TABLE_TOP
    for _ in range(len(ROWS) + 2):
        draw.line([(COLS[0], yy), (COLS[-1], yy)], fill="gray")
        yy += ROW_HEIGHT

    return img


def jpeg_roundtrip(img: Image.Image, quality: int) -> Image.Image:
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=quality)
    buf.seek(0)
    return Image.open(buf).convert("RGB")


def splice_balance(img: Image.Image, row_index: int, new_value: str) -> Image.Image:
    """Simulate an editing-tool splice: white-out the balance cell and re-type a
    freshly-rendered value at native resolution. (An earlier version of this
    generator ran the pasted text through an extra blur + resampling + JPEG pass
    to try to give it a distinct ELA fingerprint - that made it materially harder
    for Tesseract to read the digits back out, which corrupted the ledger-math
    demo for no benefit: the automated isTampered verdict only gates on
    structural PDF metadata, so ELA's output here is diagnostic/visual only and
    doesn't need to be forced. A crisp re-type keeps OCR reliable and still
    breaks reconciliation, which the ledger auditor catches deterministically.)"""
    img = img.copy()
    draw = ImageDraw.Draw(img)
    cell_font = ImageFont.truetype(FONT_PATH, 17)
    y = TABLE_TOP + ROW_HEIGHT * (row_index + 1)
    draw.rectangle([COLS[4] + 2, y + 2, COLS[5] - 2, y + ROW_HEIGHT - 2], fill="white")
    draw.text((COLS[4] + 5, y + 12), new_value, font=cell_font, fill="black")
    return img


REFERENCE_DPI = 150  # the DPI the W x H canvas was designed at


def save_as_pdf(img: Image.Image, path: str, producer: str | None = None):
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=90)
    buf.seek(0)
    # Page size must be in PDF points (1/72 inch), not raw pixels, or downstream
    # rasterization at a target DPI will wildly over/under-scale the image.
    page_w = W * 72 / REFERENCE_DPI
    page_h = H * 72 / REFERENCE_DPI
    doc = fitz.open()
    page = doc.new_page(width=page_w, height=page_h)
    page.insert_image(fitz.Rect(0, 0, page_w, page_h), stream=buf.getvalue())
    if producer:
        doc.set_metadata({"producer": producer, "creator": producer})
    doc.save(path)
    doc.close()


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    base = render_base_image()

    # 1. Clean: one honest compression generation (simulates a single scan pass).
    clean_scanned = jpeg_roundtrip(base, quality=85)
    save_as_pdf(clean_scanned, os.path.join(OUT_DIR, "sample_clean.pdf"))

    # 2. Math-tampered: splice in a fabricated balance on the Grocery Store row
    # (index 3) into the already-scanned clean image, breaking ledger reconciliation.
    # Caught by the deterministic running-balance audit (isMathConsistent=False),
    # NOT by metadata (no editing tool fingerprint here) - a forger who edits the
    # raster directly without leaving tool metadata behind.
    tampered_img = splice_balance(clean_scanned, row_index=3, new_value="85000.00")
    save_as_pdf(tampered_img, os.path.join(OUT_DIR, "sample_tampered.pdf"))

    # 3. Metadata-fingerprinted forgery: numbers are internally consistent (the
    # forger recalculated every downstream balance correctly, so ledger math alone
    # would miss it entirely) but the PDF was produced by an editing tool that
    # stamped its name into /Producer - caught by structural inspection instead.
    save_as_pdf(
        clean_scanned,
        os.path.join(OUT_DIR, "sample_photoshopped.pdf"),
        producer="Adobe Photoshop 25.0 (Macintosh)",
    )

    print(f"Wrote sample_clean.pdf, sample_tampered.pdf, sample_photoshopped.pdf to {OUT_DIR}")


if __name__ == "__main__":
    main()
