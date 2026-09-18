"""
Solvency metrics (DTI/AMB - deterministic formulas) and XGBoost-based credit scoring,
followed by the deterministic tri-state underwriting decision matrix.
"""
import os
import joblib
import pandas as pd

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "risk_model.joblib")

_model_bundle = None


def _get_model():
    global _model_bundle
    if _model_bundle is None:
        _model_bundle = joblib.load(MODEL_PATH)
    return _model_bundle


def calculate_dti(existing_monthly_debt: float, verified_monthly_income: float) -> float:
    """DTI = (Sum Monthly Debt Obligations) / (Verified Gross Inflows)"""
    if verified_monthly_income <= 0:
        return 1.0
    return round(existing_monthly_debt / verified_monthly_income, 4)


def score_applicant(
    age: int,
    verified_monthly_income: float,
    existing_monthly_debt: float,
    num_dependents: int,
    num_open_credit_lines: int,
    num_real_estate_loans: int,
    num_past_due_30_59: int,
    num_past_due_60_89: int,
    num_past_due_90_plus: int,
) -> dict:
    bundle = _get_model()
    model = bundle["model"]
    features = bundle["features"]

    dti = calculate_dti(existing_monthly_debt, verified_monthly_income)
    revolving_utilization = min(dti, 2.0)

    row = pd.DataFrame([{
        "RevolvingUtilizationOfUnsecuredLines": revolving_utilization,
        "age": age,
        "NumberOfTime30-59DaysPastDueNotWorse": num_past_due_30_59,
        "DebtRatio": dti,
        "MonthlyIncome": verified_monthly_income,
        "NumberOfOpenCreditLinesAndLoans": num_open_credit_lines,
        "NumberOfTimes90DaysLate": num_past_due_90_plus,
        "NumberRealEstateLoansOrLines": num_real_estate_loans,
        "NumberOfTime60-89DaysPastDueNotWorse": num_past_due_60_89,
        "NumberOfDependents": num_dependents,
    }])[features]

    prob_default = float(model.predict_proba(row)[0, 1])
    credit_score = int(round(900 - prob_default * 600))
    credit_score = max(300, min(900, credit_score))

    if credit_score >= 750:
        risk_band = "LOW"
    elif credit_score >= 600:
        risk_band = "MEDIUM"
    else:
        risk_band = "HIGH"

    return {
        "calculatedDTI": dti,
        "probabilityOfDefault": round(prob_default, 4),
        "creditScore": credit_score,
        "riskBand": risk_band,
    }


def route_decision(is_tampered: bool, is_math_consistent: bool, credit_score: int) -> str:
    """Deterministic tri-state underwriting decision framework (Figure/Table in report)."""
    if is_tampered:
        return "REJECT_FRAUD_ALERT"
    if not is_math_consistent:
        return "MANUAL_REVIEW"
    if credit_score >= 750:
        return "AUTO_APPROVE"
    if credit_score >= 600:
        return "MANUAL_REVIEW"
    return "REJECT"
