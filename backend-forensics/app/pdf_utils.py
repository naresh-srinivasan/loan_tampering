"""
Shared password handling for encrypted PDFs.

Real bank-issued statements downloaded from net-banking portals are very
often password-protected (typically account number, DOB or PAN based).
Per the report's own mitigation table: catch the decryption failure and ask
the applicant for a session-only passphrase - never persist it to disk or
the database.
"""
import fitz


class PdfPasswordError(Exception):
    def __init__(self, wrong_password: bool = False):
        self.wrong_password = wrong_password
        super().__init__("This PDF is password protected" if not wrong_password else "Incorrect PDF password")


def is_pdf(file_bytes: bytes, filename: str) -> bool:
    return filename.lower().endswith(".pdf") or file_bytes[:4] == b"%PDF"


def open_fitz(file_bytes: bytes, password: str | None = None) -> fitz.Document:
    """Open a PDF with PyMuPDF, raising PdfPasswordError if it's encrypted
    and no password (or the wrong one) was supplied."""
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    if doc.needs_pass:
        wrong_password = bool(password)
        if not password or not doc.authenticate(password):
            doc.close()
            raise PdfPasswordError(wrong_password=wrong_password)
    return doc
