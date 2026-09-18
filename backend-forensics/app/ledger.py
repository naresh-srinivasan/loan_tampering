"""
Ledger extraction and deterministic running-balance reconciliation.

Digital PDFs: pdfplumber table extraction (native vector text).
Scanned images / non-tabular PDFs: Tesseract OCR + anchor-text line parsing fallback.

Reconciliation uses exact Decimal arithmetic:
    Expected_Balance_i = Balance_(i-1) + Credit_i - Debit_i
A row is flagged isMathDrift if |Balance_i - Expected_Balance_i| > 0.01.
"""
import io
import os
import re
import shutil
from decimal import Decimal, InvalidOperation
from datetime import datetime

import cv2
import fitz
import numpy as np
import pdfplumber
import pytesseract
from PIL import Image

# On Windows, installing Tesseract doesn't reliably put it on PATH. Respect an
# explicit override (TESSERACT_CMD env var), then fall back to the default
# install location of the common UB-Mannheim Windows build, before relying on
# PATH lookup.
_DEFAULT_WINDOWS_TESSERACT = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
if os.environ.get("TESSERACT_CMD"):
    pytesseract.pytesseract.tesseract_cmd = os.environ["TESSERACT_CMD"]
elif not shutil.which("tesseract") and os.path.exists(_DEFAULT_WINDOWS_TESSERACT):
    pytesseract.pytesseract.tesseract_cmd = _DEFAULT_WINDOWS_TESSERACT

print(f"[ledger] pytesseract.tesseract_cmd resolved to: {pytesseract.pytesseract.tesseract_cmd!r}")
print(f"[ledger] os.path.exists(that path): {os.path.exists(pytesseract.pytesseract.tesseract_cmd)}")

DATE_PATTERN = r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})"
NUMBER_PATTERN = r"-?[\d,]+\.\d{2}"

AMOUNT_DRIFT_TOLERANCE = Decimal("0.01")


def _to_decimal(value) -> Decimal:
    if value is None:
        return Decimal("0")
    s = str(value).replace(",", "").replace("₹", "").replace("$", "").strip()
    if s in ("", "-", "nan"):
        return Decimal("0")
    try:
        return Decimal(s)
    except InvalidOperation:
        return Decimal("0")


def _parse_date(value: str):
    value = value.strip()
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y", "%Y-%m-%d", "%d/%m/%y"):
        try:
            return datetime.strptime(value, fmt).date().isoformat()
        except ValueError:
            continue
    return value


def _extract_rows_pdfplumber(pdf_bytes: bytes) -> list[dict]:
    rows = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            for table in page.extract_tables():
                if not table or len(table) < 2:
                    continue
                header = [(c or "").strip().lower() for c in table[0]]

                def find_col(keywords):
                    for i, h in enumerate(header):
                        if any(k in h for k in keywords):
                            return i
                    return None

                idx_date = find_col(["date"])
                idx_desc = find_col(["narration", "description", "particular", "detail"])
                idx_credit = find_col(["credit", "deposit", "cr"])
                idx_debit = find_col(["debit", "withdrawal", "dr"])
                idx_balance = find_col(["balance"])

                if idx_date is None or idx_balance is None:
                    continue

                for row in table[1:]:
                    if not row or len(row) <= idx_date:
                        continue
                    date_cell = (row[idx_date] or "").strip()
                    if not re.search(DATE_PATTERN, date_cell):
                        continue
                    desc = (row[idx_desc] or "").strip() if idx_desc is not None and idx_desc < len(row) else ""
                    credit = _to_decimal(row[idx_credit]) if idx_credit is not None and idx_credit < len(row) else Decimal("0")
                    debit = _to_decimal(row[idx_debit]) if idx_debit is not None and idx_debit < len(row) else Decimal("0")
                    balance = _to_decimal(row[idx_balance]) if idx_balance < len(row) else Decimal("0")
                    rows.append({
                        "txnDate": _parse_date(date_cell),
                        "description": desc,
                        "credit": credit,
                        "debit": debit,
                        "balance": balance,
                    })
    return rows


def _page_images(file_bytes: bytes, filename: str) -> list[Image.Image]:
    lower = filename.lower()
    if lower.endswith(".pdf") or file_bytes[:4] == b"%PDF":
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        images = []
        for page in doc:
            pix = page.get_pixmap(dpi=300)
            images.append(Image.open(io.BytesIO(pix.tobytes("png"))))
        doc.close()
        return images
    return [Image.open(io.BytesIO(file_bytes))]


def _find_line_positions(line_mask: np.ndarray, axis: int, min_gap: int = 10) -> list[int]:
    """Collapse a binary line mask into the center coordinate of each contiguous
    run of foreground pixels along the given projection axis."""
    profile = line_mask.sum(axis=axis)
    threshold = profile.max() * 0.3 if profile.max() > 0 else 1
    on = profile > threshold
    positions = []
    run_start = None
    for i, val in enumerate(on):
        if val and run_start is None:
            run_start = i
        elif not val and run_start is not None:
            positions.append((run_start + i - 1) // 2)
            run_start = None
    if run_start is not None:
        positions.append((run_start + len(on) - 1) // 2)
    merged = []
    for p in positions:
        if merged and p - merged[-1] < min_gap:
            continue
        merged.append(p)
    return merged


def _detect_grid(img: Image.Image) -> tuple[list[int], list[int]] | None:
    """OpenCV-based adaptive table-grid detection: isolates long horizontal and
    vertical strokes via morphological opening to recover row/column boundaries,
    used as the anchor geometry for per-cell OCR (fallback for non-tabular /
    scanned statements where no embedded PDF table structure exists)."""
    arr = cv2.cvtColor(np.array(img.convert("RGB")), cv2.COLOR_RGB2GRAY)
    binary = cv2.adaptiveThreshold(
        arr, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 15, 10
    )

    h, w = binary.shape
    h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (w // 20, 1))
    horizontal = cv2.erode(binary, h_kernel, iterations=1)
    horizontal = cv2.dilate(horizontal, h_kernel, iterations=1)

    v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, h // 40))
    vertical = cv2.erode(binary, v_kernel, iterations=1)
    vertical = cv2.dilate(vertical, v_kernel, iterations=1)

    row_ys = _find_line_positions(horizontal, axis=1)
    col_xs = _find_line_positions(vertical, axis=0)

    if len(row_ys) < 3 or len(col_xs) < 3:
        return None
    return row_ys, col_xs


HEADER_KEYWORDS = {
    "date": "date",
    "narration": "description", "description": "description", "particular": "description",
    "particulars": "description", "detail": "description",
    "credit": "credit", "deposit": "credit",
    "debit": "debit", "withdrawal": "debit",
    "balance": "balance",
}
CANONICAL_ORDER = ["date", "description", "credit", "debit", "balance"]


NUMERIC_OCR_CONFIG = "--psm 7 -c tessedit_char_whitelist=0123456789.,-"


def _ocr_cell(img: Image.Image, numeric: bool = False) -> str:
    config = NUMERIC_OCR_CONFIG if numeric else "--psm 7"
    # Upscale small cells - Tesseract's accuracy drops sharply below ~30px tall.
    if img.height < 40:
        scale = 40 / img.height
        img = img.resize((int(img.width * scale), int(img.height * scale)), Image.LANCZOS)
    return pytesseract.image_to_string(img, config=config).strip()


def _extract_rows_ocr(file_bytes: bytes, filename: str) -> list[dict]:
    """OpenCV grid detection + per-cell Tesseract OCR fallback, used for scanned
    images and non-tabular PDFs. Reading each cell in isolation (rather than
    parsing flat OCR text) removes the ambiguity between Credit and Debit
    amounts that plain left-to-right token order cannot resolve."""
    rows = []
    for img in _page_images(file_bytes, filename):
        grid = _detect_grid(img)
        if grid is None:
            continue
        row_ys, col_xs = grid

        n_cols = len(col_xs) - 1
        inset = 6  # keep gridlines/borders out of the crop - they OCR as stray digits

        def crop_cell(c: int, r: int) -> Image.Image:
            box = (col_xs[c] + inset, row_ys[r] + inset, col_xs[c + 1] - inset, row_ys[r + 1] - inset)
            return img.crop(box)

        header_cells = [_ocr_cell(crop_cell(c, 0)) for c in range(n_cols)]
        roles = [HEADER_KEYWORDS.get(h.strip(".:").lower()) for h in header_cells]
        if n_cols == len(CANONICAL_ORDER) and roles.count(None) > 2:
            roles = CANONICAL_ORDER

        if "date" not in roles or "balance" not in roles:
            continue

        numeric_roles = {"credit", "debit", "balance"}
        for r in range(1, len(row_ys) - 1):
            cell_texts = [
                _ocr_cell(crop_cell(c, r), numeric=roles[c] in numeric_roles)
                for c in range(n_cols)
            ]
            values = dict(zip(roles, cell_texts))
            date_text = values.get("date", "")
            if not re.search(DATE_PATTERN, date_text):
                continue

            rows.append({
                "txnDate": _parse_date(re.search(DATE_PATTERN, date_text).group(0)),
                "description": values.get("description", "").strip() or "Transaction",
                "credit": _to_decimal(values.get("credit")),
                "debit": _to_decimal(values.get("debit")),
                "balance": _to_decimal(values.get("balance")),
            })
    return rows


def extract_ledger(file_bytes: bytes, filename: str) -> tuple[list[dict], str]:
    """Returns (rows, extraction_method)."""
    is_pdf = filename.lower().endswith(".pdf") or file_bytes[:4] == b"%PDF"
    if is_pdf:
        rows = _extract_rows_pdfplumber(file_bytes)
        if rows:
            return rows, "pdfplumber"
    rows = _extract_rows_ocr(file_bytes, filename)
    return rows, "tesseract_ocr"


def reconcile_ledger(rows: list[dict]) -> dict:
    """Sequential balance audit per Algorithm 2 in the report."""
    if not rows:
        # No transaction rows could be extracted - this is NOT the same thing as
        # "the ledger is consistent". Reporting isMathConsistent=True here would
        # silently pass a document nobody actually checked, which is worse than
        # any false positive. isMathConsistent=None means "unverifiable" and the
        # gateway/frontend route this to manual review rather than auto-approving.
        return {
            "lineItems": [],
            "isMathConsistent": None,
            "extractionFailed": True,
            "openingBalance": 0.0,
            "closingBalance": 0.0,
            "averageMonthlyBalance": 0.0,
            "totalMonthlyCredits": 0.0,
            "driftCount": 0,
        }

    line_items = []
    prev_balance = rows[0]["balance"]
    drift_count = 0
    balances = []
    monthly_credits: dict[str, Decimal] = {}

    for i, row in enumerate(rows):
        if i == 0:
            expected = row["balance"]
            is_drift = False
        else:
            expected = prev_balance + row["credit"] - row["debit"]
            is_drift = abs(row["balance"] - expected) > AMOUNT_DRIFT_TOLERANCE
            if is_drift:
                drift_count += 1

        line_items.append({
            "txnDate": row["txnDate"],
            "description": row["description"],
            "credit": float(row["credit"]),
            "debit": float(row["debit"]),
            "balance": float(row["balance"]),
            "expectedBalance": float(expected),
            "isMathDrift": is_drift,
        })

        balances.append(row["balance"])
        month_key = row["txnDate"][:7] if len(row["txnDate"]) >= 7 else "unknown"
        monthly_credits[month_key] = monthly_credits.get(month_key, Decimal("0")) + row["credit"]

        prev_balance = row["balance"]

    amb = float(sum(balances) / len(balances)) if balances else 0.0
    avg_monthly_credit = float(sum(monthly_credits.values()) / len(monthly_credits)) if monthly_credits else 0.0

    return {
        "lineItems": line_items,
        "isMathConsistent": drift_count == 0,
        "extractionFailed": False,
        "openingBalance": float(rows[0]["balance"]),
        "closingBalance": float(rows[-1]["balance"]),
        "averageMonthlyBalance": round(amb, 2),
        "totalMonthlyCredits": round(avg_monthly_credit, 2),
        "driftCount": drift_count,
    }


def analyze_ledger(file_bytes: bytes, filename: str) -> dict:
    rows, method = extract_ledger(file_bytes, filename)
    result = reconcile_ledger(rows)
    result["extractionMethod"] = method
    return result
