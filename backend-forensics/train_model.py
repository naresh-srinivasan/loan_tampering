"""
Trains the credit risk model used by the /risk/score endpoint.

Dataset: "Give Me Some Credit" (Kaggle) - cs-training.csv
Target column SeriousDlqin2yrs (1 = defaulted / seriously delinquent within 2 years).

We train a binary classifier on the dataset's native features, then at inference
time translate the applicant's forensic pipeline output (DTI, AMB, income, etc.)
into the same feature space so the trained model can score them. The predicted
probability of default is inverted into a 300-900 credit score band.
"""
import pandas as pd
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score
import joblib
import os

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "cs-training.csv")
MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "risk_model.joblib")

FEATURES = [
    "RevolvingUtilizationOfUnsecuredLines",
    "age",
    "NumberOfTime30-59DaysPastDueNotWorse",
    "DebtRatio",
    "MonthlyIncome",
    "NumberOfOpenCreditLinesAndLoans",
    "NumberOfTimes90DaysLate",
    "NumberRealEstateLoansOrLines",
    "NumberOfTime60-89DaysPastDueNotWorse",
    "NumberOfDependents",
]
TARGET = "SeriousDlqin2yrs"


def main():
    df = pd.read_csv(DATA_PATH, index_col=0)

    df["MonthlyIncome"] = df["MonthlyIncome"].fillna(df["MonthlyIncome"].median())
    df["NumberOfDependents"] = df["NumberOfDependents"].fillna(0)

    X = df[FEATURES]
    y = df[TARGET]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = xgb.XGBClassifier(
        n_estimators=200,
        max_depth=4,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric="auc",
        random_state=42,
    )
    model.fit(X_train, y_train)

    auc = roc_auc_score(y_test, model.predict_proba(X_test)[:, 1])
    print(f"Validation AUC: {auc:.4f}")

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump({"model": model, "features": FEATURES}, MODEL_PATH)
    print(f"Saved model to {MODEL_PATH}")


if __name__ == "__main__":
    main()
