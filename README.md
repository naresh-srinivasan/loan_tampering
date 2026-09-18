# AI-Driven Loan Underwriting & Document Fraud Detection (Prototype)

A local, single-user prototype implementing the system described in the project's
First Review Report: applicants upload bank statements, a Python forensics/ML
service runs document tamper detection (metadata inspection + Error Level Analysis),
deterministic ledger reconciliation, and credit risk scoring, and a Node.js gateway
persists everything and routes applications through a tri-state underwriting decision
(AUTO_APPROVE / MANUAL_REVIEW / REJECT / REJECT_FRAUD_ALERT) that a loan officer can
review and override.

## Architecture

```
frontend (Next.js 14)  →  backend-gateway (Node/Express, JWT auth, SQLite)  →  backend-forensics (Python FastAPI)
```

- **frontend/** — applicant portal + loan officer console (split-screen document/heatmap
  viewer, ledger reconciliation table, decision panel, audit trail).
- **backend-gateway/** — JWT auth & RBAC (Applicant/Officer roles), magic-byte file
  validation, SQLite persistence (`users`, `applications`, `documents`,
  `ledger_line_items`, `audit_logs`), proxies documents to the forensics service.
- **backend-forensics/** — FastAPI microservice: PDF structural/metadata inspection,
  Error Level Analysis, OCR/table extraction (pdfplumber + OpenCV-grid + Tesseract
  fallback), deterministic ledger reconciliation, DTI/AMB calculation, and an XGBoost
  credit risk model trained on the "Give Me Some Credit" Kaggle dataset.

See `backend-forensics/app/forensics.py` and `ledger.py` for design notes on why
Error Level Analysis is treated as a diagnostic/visual signal rather than an automatic
fraud gate, and why the ledger-math and PDF-metadata checks are the two fully
deterministic, zero-false-positive signals used to drive routing automatically.

## Prerequisites

- Node.js 18+
- Python 3.10+ with `venv`
- Tesseract OCR:
  - macOS/Linux: `brew install tesseract` / `apt install tesseract-ocr`
  - Windows: install from https://github.com/UB-Mannheim/tesseract/wiki, then **restart
    your terminal** (PATH changes don't apply to already-open ones). The forensics
    service also auto-detects the default Windows install path
    (`C:\Program Files\Tesseract-OCR\tesseract.exe`) even if it's not on PATH, or you
    can set it explicitly with the `TESSERACT_CMD` environment variable.

## First-time setup

macOS/Linux:
```bash
# 1. Forensics service
cd backend-forensics
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/pip install reportlab   # only needed to (re)generate sample_docs/
.venv/bin/python train_model.py   # trains models/risk_model.joblib from data/cs-training.csv

# 2. Gateway
cd ../backend-gateway
npm install

# 3. Frontend
cd ../frontend
npm install
```

Windows (cmd/PowerShell) — same steps, but venv executables live under `.venv\Scripts\`:
```bat
cd backend-forensics
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt
.venv\Scripts\pip install reportlab
.venv\Scripts\python train_model.py

cd ..\backend-gateway
npm install

cd ..\frontend
npm install
```
Note: a Python venv hard-codes absolute paths on Windows, so it breaks if you move/copy
the project folder after creating it. If you relocate the project, delete `.venv` and
recreate it (`python -m venv .venv`) from its new location.

## Running (3 terminals)

macOS/Linux:
```bash
# Terminal 1
cd backend-forensics && .venv/bin/uvicorn app.main:app --port 8001

# Terminal 2
cd backend-gateway && npm start        # http://localhost:4000

# Terminal 3
cd frontend && npm run dev             # http://localhost:3000
```

Windows:
```bat
:: Terminal 1
cd backend-forensics && .venv\Scripts\uvicorn app.main:app --port 8001

:: Terminal 2
cd backend-gateway && npm start

:: Terminal 3
cd frontend && npm run dev
```

Open http://localhost:3000, register as either an **Applicant** or a **Loan Officer**,
and start a loan application.

## Sample documents for testing

`backend-forensics/sample_docs/` (regenerate with
`.venv/bin/python scripts/generate_sample_statement.py`) contains three statements that
exercise all three underwriting outcomes:

| File | What it demonstrates | Expected outcome |
|---|---|---|
| `sample_clean.pdf` | Internally consistent ledger, no editing-tool fingerprint | `AUTO_APPROVE` |
| `sample_tampered.pdf` | One balance cell altered, breaking the running-balance reconciliation | `MANUAL_REVIEW` (caught by deterministic ledger math) |
| `sample_photoshopped.pdf` | Numbers are consistent, but `/Producer` metadata says "Adobe Photoshop" | `REJECT_FRAUD_ALERT` (caught by structural PDF inspection) |

## Smoke tests

Playwright browser smoke tests exercise the full applicant and officer flows against
the running app:

```bash
cd frontend
npm install -D playwright
node scripts/smoke-officer.js     # login as officer, browse queue + detail
node scripts/smoke-applicant.js   # register, create application, upload, see results
```

## Notes on scope (prototype, single local user)

- SQLite instead of MySQL; no separate message queue - the gateway calls the Python
  service synchronously and stores the result.
- The XGBoost risk model is trained on the public "Give Me Some Credit" Kaggle dataset
  (income/DTI/delinquency features), not on real underwriting outcomes for this system -
  it demonstrates the ML risk-scoring layer end-to-end but its scores are illustrative,
  not production-calibrated.
- No RBAC beyond Applicant/Officer self-registration (no separate Admin onboarding flow).
- **Ledger extraction is tuned for the 3 sample documents, not arbitrary real bank
  statements.** Digital PDFs with an embedded text table go through `pdfplumber` (fairly
  general). Scanned/image statements go through custom OpenCV grid-detection, which
  looks for visible cell borders - most real statements don't draw a full grid, so this
  will often find nothing. When it does, the app does NOT silently report the ledger as
  "consistent" - it sets `isMathConsistent: null` / `extractionFailed: true`, adds a
  visible anomaly note, and routes the application to `MANUAL_REVIEW` instead of
  auto-approving. Forensics (metadata + ELA) and risk scoring still run regardless.
