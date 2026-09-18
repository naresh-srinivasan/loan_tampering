# Presentation Content — AI-Driven Loan Underwriting & Document Fraud Detection System

> This file contains the slide-by-slide content (bulleted, presentation-ready) for building the PPT.
> Copy each section below into its own slide. Formatting notes are in *italics* and should not be typed onto the slide itself.

---

## Slide 1 — Title Slide

*Layout: Reg. No. bottom-left, Guide details bottom-right, title centered.*

**AUTOMATED AI-DRIVEN LOAN UNDERWRITING & DOCUMENT FRAUD DETECTION SYSTEM**

- Name: Naresh S
- Roll No: 2436MCA0047

*Bottom-left:*
- Reg. No: 67224200080

*Bottom-right:*
- Guide: Dr. R. Baskaran
- Designation: Professor, Department of Computer Science and Engineering, CEG Campus, Anna University, Chennai – 25

---

## Slide 2 — Introduction

- Retail lenders must verify an applicant's income and financial conduct before sanctioning a loan
- Verification today relies on **unstructured document uploads** — bank statements, payslips, tax returns — because programmatic alternatives (Account Aggregator / open banking) suffer 40–60% applicant drop-off from OTP failures, forgotten net-banking credentials, and consent friction
- Unstructured uploads open the door to **document tampering**: edited balances, altered transaction narrations, deleted EMI entries using ordinary tools (Photoshop, Canva, online PDF editors)
- Manual underwriting cannot reliably catch this:
  - Human eyes cannot detect font substitution, resampling artifacts, or micro-level compression differences
  - Manually auditing a running balance across hundreds of transaction rows is slow and error-prone
  - Throughput is capped at ~10–15 files per credit officer per day, 2–4 business days per file
- **This project builds a prototype pipeline that automates fraud detection, financial reconciliation, and credit risk scoring, routing each application to Auto-Approve / Manual Review / Reject-Fraud-Alert in seconds instead of days**

---

## Slide 3 — Domain: Why AI Is Needed Here

- The system uses AI/ML in exactly **two** places — this project is intentionally precise about that distinction, not "AI-washing" every component:
  1. **OCR (Tesseract)** — a pretrained model, used only as a fallback to read scanned/photographed statements when no digital text layer exists
  2. **XGBoost credit risk model** — a trained classifier that converts financial features (income, existing debt, delinquency history) into a default-probability score
- The two components that actually **catch fraud** are deterministic, not AI:
  - **Error Level Analysis (ELA)** — a fixed image-forensics formula, always produces the same output for the same input
  - **Ledger arithmetic reconciliation** — exact decimal math, not learned from data
- Why this distinction matters for the domain:
  - Deterministic checks give zero false-positive risk and are explainable to a bank's compliance/audit team
  - ML is reserved for the two problems that are genuinely probabilistic: reading messy scanned text, and predicting default risk from incomplete financial signals
- This hybrid approach (deterministic forensics + narrow, targeted ML) is what makes the system usable in a regulated lending context, where an unexplainable black-box "AI says reject" is not acceptable

---

## Slide 4 — Literature Survey

- **N. Krawetz, "A Picture's Worth… Digital Image Analysis and Forensics," Hacker Factor Solutions, 2007** — foundational technique for Error Level Analysis; recompressing an image at a known JPEG quality and measuring the local error is the basis of this project's tamper-heatmap module
- **T. Chen and C. Guestrin, "XGBoost: A Scalable Tree Boosting System," ACM SIGKDD, 2016** — the gradient-boosted tree algorithm used for the credit-risk scoring layer; chosen for its strong performance on tabular financial features and built-in handling of missing values
- **Reserve Bank of India, "Master Direction – NBFC – Account Aggregator Directions," RBI/DNBR/2016-17/45 (updated 2023)** — describes the programmatic/open-banking data-sharing rail that this project's unstructured-document pipeline exists *alongside*, and explains why document uploads remain a necessary fallback channel (consent friction, OTP failures)
- **PyMuPDF (fitz) documentation, 2024** — library used for low-level PDF structural inspection (metadata, font resource dictionaries, page rasterization)
- **R. Smith, "An Overview of the Tesseract OCR Engine," ICDAR 2007** — the OCR engine used as the scanned-document fallback path
- **Industry practice review (fintech straight-through-processing):** several digital lenders publicly describe auto-approving low-risk retail loan segments without manual review, reserving human underwriting time for ambiguous or flagged cases — this project's tri-state decision matrix (Auto-Approve / Manual Review / Reject-Fraud-Alert) mirrors that real-world pattern rather than inventing a novel workflow
- **Gap identified across the above sources:** no single system combines *forensic image analysis*, *low-level PDF structural inspection*, and *deterministic ledger reconciliation* in one applicant-facing underwriting pipeline — each technique above is normally discussed in isolation (forensics research, ML research, or regulatory policy). This project's contribution is integrating all three into one decision pipeline

---

## Slide 5 — System Architecture

*Insert architecture diagram image here (see description below for what to draw, or export one from the running project).*

- **Three-tier architecture:**
  1. **Frontend (Next.js 14 + React + Tailwind)** — applicant portal (apply, upload, track status) and loan officer console (queue, split-screen document/heatmap review, decision panel, audit trail)
  2. **API Gateway (Node.js / Express)** — JWT authentication & role-based access control (Applicant / Officer), magic-byte file validation, SQLite persistence, orchestrates calls to the forensics service
  3. **AI & Forensics Microservice (Python / FastAPI)** — PDF metadata & font inspection, Error Level Analysis, ledger table extraction (pdfplumber + OpenCV-grid + Tesseract OCR fallback), deterministic reconciliation, DTI/AMB calculation, XGBoost risk scoring
- **Data flow:** Applicant uploads document → Gateway validates & forwards to Forensics service → Forensics runs all five checks → Gateway persists results & applies decision routing → Officer reviews flagged/ambiguous cases → Decision written to an append-only audit log
- **Persistence:** five tables — `users`, `applications`, `documents`, `ledger_line_items`, `audit_logs`

---

## Slide 6 — Module 1: Secure Ingestion & Authentication

- JWT-based authentication with two roles: Applicant, Loan Officer
- Role-based access control enforced at every API route (an applicant can only see their own applications; only officers can issue a decision)
- **Magic-byte validation** on every upload — inspects the first few bytes of the file (`%PDF-`, `\xFF\xD8\xFF` for JPEG, PNG signature) rather than trusting the file extension, before the file is forwarded anywhere
- File buffer is held in memory during validation; only written to disk after passing the magic-byte check
- Combined single-step application flow: applicant fills loan details **and** attaches the supporting document in one submission — reduces drop-off compared to a multi-step process

---

## Slide 7 — Module 2: PDF Structural & Metadata Forensics

- Uses PyMuPDF (fitz) to walk the PDF's internal structure without rendering it as an image first
- **Producer/Creator fingerprinting:** checks `/Producer` and `/Creator` metadata tags against a list of known editing tools (Adobe Photoshop, Canva, iLovePDF, GIMP, Sejda, etc.)
- **Font-family variance check:** enumerates every font resource used across all pages; an unusually high number of distinct font families in a short financial statement is consistent with a spliced/edited numeric field
- **Timestamp check:** flags a mismatch between the PDF's creation and modification timestamps
- This is the **only fully deterministic, zero-false-positive signal** that gates the automatic `REJECT_FRAUD_ALERT` decision — a `/Producer` tag either says "Photoshop" or it doesn't

---

## Slide 8 — Module 3: Error Level Analysis (ELA)

- Recompresses the document's rendered image at a fixed JPEG quality factor (Q = 92) and computes the pixel-wise difference against the original
- Formula: `ELA(x,y) = S · |I(x,y) − J(I(x,y), Q)|`, where `S` = 15 (amplification scalar)
- Produces a visual **tamper heatmap** — brighter regions indicate higher recompression error
- **Design decision (explained honestly on the slide):** a whole-image error statistic cannot reliably separate a genuine splice from ordinary high-frequency noise that any printed or typed text naturally produces. This project therefore treats ELA's output as **supporting visual evidence for the human reviewer** (the split-screen workspace), not as an automatic fraud gate by itself — the automatic decision is driven only by the deterministic metadata check and ledger math
- This is a documented, known limitation of ELA in the forensics literature, not unique to this implementation

---

## Slide 9 — Module 4: Ledger Table Extraction

- **Two extraction paths, chosen automatically based on document type:**
  1. **Digital PDFs:** `pdfplumber` extracts the native text-based table directly (fast, high accuracy)
  2. **Scanned/photographed statements:** OpenCV grid-line detection locates row/column boundaries, then each cell is OCR'd individually with Tesseract — reading cells in isolation (rather than parsing a flat line of text) removes the ambiguity between a Credit and a Debit amount that plain left-to-right token order cannot resolve
- Handles **password-protected PDFs** (very common for bank-issued statements) — detects encryption upfront and prompts for a session-only passphrase, never persisted to disk or database
- If no transaction table can be extracted at all, the system does **not** silently assume the ledger is fine — it flags `extractionFailed` and routes to manual review instead

---

## Slide 10 — Module 5: Deterministic Ledger Reconciliation

- Every transaction row is checked against the previous row using **exact decimal arithmetic** (no floating-point rounding error)
- Formula: `Expected_Balance(i) = Balance(i−1) + Credit(i) − Debit(i)`
- A row is flagged `isMathDrift = True` if `|Balance(i) − Expected_Balance(i)| > 0.01`
- This single check catches a large and important class of fraud: someone edits one balance figure but doesn't recompute every downstream row — the arithmetic breaks and cascades forward, visible immediately
- Fully deterministic — same input always produces the same output, no training or tuning involved

---

## Slide 11 — Module 6: Financial Metrics & Credit Risk Scoring

- **Average Monthly Balance (AMB):** `AMB = (1/N) · Σ Daily Balance(k)`
- **Debt-to-Income (DTI):** `DTI = (Σ Monthly Debt Obligations) / (Verified Gross Inflows)`
- **XGBoost credit risk model:** trained on the public "Give Me Some Credit" dataset (income, revolving utilization, delinquency history, dependents) to output a probability of default
- Probability of default is mapped onto a **300–900 credit score band**: `Score = 900 − (P_default × 600)`
- Risk band derived from score: `≥750 = LOW`, `600–749 = MEDIUM`, `<600 = HIGH`

---

## Slide 12 — Module 7: Tri-State Decision Routing & Human-in-the-Loop

- **Decision matrix** (deterministic rule table, not a model):

| Tamper Flag | Ledger Consistent | Credit Score | Outcome |
|---|---|---|---|
| TRUE | any | any | `REJECT_FRAUD_ALERT` |
| FALSE | FALSE | any | `MANUAL_REVIEW` |
| FALSE | TRUE | ≥ 750 | `AUTO_APPROVE` (recommendation) |
| FALSE | TRUE | 600–749 | `MANUAL_REVIEW` |
| FALSE | TRUE | < 600 | `REJECT` |

- **Human-in-the-loop safeguard:** even an `AUTO_APPROVE` recommendation does not silently finalize a loan — a loan officer confirms it with a single click ("Confirm & Approve"). Only a fraud/hard-reject verdict is finalized without a human, since there is no approval action to protect against there
- This keeps every approval accountable to a named officer while still cutting review time down to a one-click confirmation for the clean, unambiguous cases

---

## Slide 13 — Module 8: Officer Review Workspace & Audit Trail

- **Split-screen workspace:** original uploaded document displayed side-by-side with the ELA tamper heatmap, plus the full ledger reconciliation table with drifted rows highlighted
- **Persistent queue sidebar:** officer can click through applications one after another without returning to a separate list page each time
- **WORM-style audit log:** every automated analysis and every human decision is written to an append-only `audit_logs` table with a SHA-256 evidence hash of the forensic result, the reviewing officer's identity, and a timestamp — creating a tamper-evident record of who decided what and when

---

## Slide 14 — Performance Metrics

*This is how the system's own outputs are checked for correctness.*

- **Ledger reconciliation accuracy:** `Expected_Balance(i) = Balance(i−1) + Credit(i) − Debit(i)`; tolerance `|Balance(i) − Expected_Balance(i)| ≤ 0.01` — validated against synthetic clean vs. tampered statements (0 drifts on clean, correctly localizes the exact tampered row + its cascade on tampered)
- **XGBoost model validation:** trained/test split (80/20) on the Kaggle "Give Me Some Credit" dataset; **AUC-ROC = 0.87** on the held-out test set
- **Credit score mapping bounds check:** `Score = 900 − (P_default × 600)`, clipped to `[300, 900]`
- **Forensic detection formula (ELA):** `tamper_score = (std_error / (mean_error + 1e-5)) × 10`; flagged if `tamper_score > 35` or `max_error > 220` (reported as a diagnostic metric; see Slide 8 for why it is not used as the sole automatic gate)
- **End-to-end pipeline latency target:** full document analysis (forensics + ledger + scoring) completes in well under the report's 10-second SLA for a single-page statement
- **Manual verification performed:** three test documents (clean / math-tampered / metadata-fingerprinted) run through the full pipeline and confirmed to produce the three distinct, correct decision outcomes (Auto-Approve, Manual Review, Reject-Fraud-Alert)

---

## Slide 15 — References

1. N. Krawetz, "A Picture's Worth… Digital Image Analysis and Forensics," Hacker Factor Solutions, Tech. Rep., 2007
2. T. Chen and C. Guestrin, "XGBoost: A Scalable Tree Boosting System," in *Proc. 22nd ACM SIGKDD International Conference on Knowledge Discovery and Data Mining*, 2016, pp. 785–794
3. Reserve Bank of India, "Master Direction – Non-Banking Financial Company – Account Aggregator Directions," RBI/DNBR/2016-17/45, updated 2023
4. PyMuPDF Contributors, "PyMuPDF: High-performance Python library for data extraction and analysis of PDF documents," 2024. [Online]. Available: https://pymupdf.readthedocs.io
5. R. Smith, "An Overview of the Tesseract OCR Engine," in *Proc. Ninth International Conference on Document Analysis and Recognition (ICDAR 2007)*, vol. 2, pp. 629–633
6. Oracle Corporation, "MySQL 8.0 Reference Manual," 2024. [Online]. Available: https://dev.mysql.com/doc/refman/8.0/en/
7. "Give Me Some Credit" dataset, Kaggle. [Online]. Available: https://www.kaggle.com/c/GiveMeSomeCredit
8. FastAPI documentation. [Online]. Available: https://fastapi.tiangolo.com
9. Next.js documentation. [Online]. Available: https://nextjs.org/docs

---

## Notes for building the architecture diagram (Slide 5)

Draw three vertically stacked boxes connected top-to-bottom with arrows:
1. **Top box:** "Frontend — Next.js 14 / React / Tailwind" — sub-bullets: Applicant Portal, Officer Console (split-screen viewer)
2. **Middle box:** "API Gateway — Node.js / Express" — sub-bullets: JWT Auth & RBAC, Magic-Byte Validation, SQLite Persistence
3. **Bottom box, split into two side-by-side sub-boxes:**
   - "AI & Forensics Microservice — Python FastAPI" — sub-bullets: Metadata/Font Inspection, Error Level Analysis, Ledger Extraction & Reconciliation, XGBoost Risk Scoring
   - "Persistence Layer — SQLite" — sub-bullets: users, applications, documents, ledger_line_items, audit_logs

Label the arrow between Frontend and Gateway as "HTTPS / REST", and between Gateway and Forensics service as "REST / multipart file upload".
