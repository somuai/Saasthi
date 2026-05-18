#!/usr/bin/env python3
"""Train RF risk model — optional sklearn pipeline (install scikit-learn separately)."""
from pathlib import Path

MODEL_PATH = Path(__file__).resolve().parents[1] / "models" / "rf_v1.pkl"


def main():
    try:
        import joblib  # noqa: F401
        from sklearn.ensemble import RandomForestClassifier  # noqa: F401
    except ImportError:
        print("Install: pip install scikit-learn joblib")
        print("Then export feature matrix from Django and save to", MODEL_PATH)
        return
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    print("Stub: wire feature export from apps.patients and save classifier to", MODEL_PATH)


if __name__ == "__main__":
    main()
