from fastapi import FastAPI, UploadFile, File, Form
from pydantic import BaseModel

from . import forensics, ledger, risk

app = FastAPI(title="AI Loan Forensics & Risk Microservice")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze(file: UploadFile = File(...), docType: str = Form("BANK_STATEMENT")):
    file_bytes = await file.read()
    filename = file.filename or "upload"

    forensic_result = forensics.analyze_document_forensics(file_bytes, filename)

    financial_analysis = None
    if docType == "BANK_STATEMENT":
        financial_analysis = ledger.analyze_ledger(file_bytes, filename)

    return {
        "forensicResult": forensic_result,
        "financialAnalysis": financial_analysis,
    }


class ScoreRequest(BaseModel):
    age: int
    statedMonthlyIncome: float
    existingMonthlyDebt: float
    numDependents: int = 0
    numOpenCreditLines: int = 5
    numRealEstateLoans: int = 0
    numPastDue30_59: int = 0
    numPastDue60_89: int = 0
    numPastDue90Plus: int = 0
    verifiedMonthlyIncome: float | None = None
    isTampered: bool = False
    isMathConsistent: bool = True


@app.post("/score")
def score(req: ScoreRequest):
    verified_income = req.verifiedMonthlyIncome or req.statedMonthlyIncome

    result = risk.score_applicant(
        age=req.age,
        verified_monthly_income=verified_income,
        existing_monthly_debt=req.existingMonthlyDebt,
        num_dependents=req.numDependents,
        num_open_credit_lines=req.numOpenCreditLines,
        num_real_estate_loans=req.numRealEstateLoans,
        num_past_due_30_59=req.numPastDue30_59,
        num_past_due_60_89=req.numPastDue60_89,
        num_past_due_90_plus=req.numPastDue90Plus,
    )

    recommendation = risk.route_decision(
        is_tampered=req.isTampered,
        is_math_consistent=req.isMathConsistent,
        credit_score=result["creditScore"],
    )

    return {**result, "recommendation": recommendation, "verifiedMonthlyIncome": verified_income}
