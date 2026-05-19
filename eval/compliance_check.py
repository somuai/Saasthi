#!/usr/bin/env python3
"""Static compliance checks — no network."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "shaasthi-app"
API = ROOT / "shaasthi-api"

FAILURES = []


def fail(msg: str) -> None:
    FAILURES.append(msg)


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def check_aadhaar_schema() -> None:
    schema = read("shaasthi-app/src/database/schema.js")
    if 'name: "aadhaar"' in schema and "aadhaar_last4" not in schema:
        fail("full aadhaar column found in schema")
    if "aadhaar_last4" not in schema and "mother_aadhaar_last4" not in schema:
        fail("expected aadhaar_last4 fields in schema")


def check_no_fetal_sex() -> None:
    for rel in [
        "shaasthi-app/src/ml/riskScorer.js",
        "shaasthi-app/src/ml/mcpRiskRules.js",
    ]:
        text = read(rel).lower()
        for bad in ("fetal_sex", "fetal sex", "ultrasound_sex", "baby_gender"):
            if bad in text:
                fail(f"{rel} contains prohibited term: {bad}")


def check_incentive_ethics() -> None:
    for rel in [
        "shaasthi-app/src/screens/tabs/EarningsScreen.jsx",
        "shaasthi-app/src/screens/tabs/FollowupsScreen.jsx",
    ]:
        text = read(rel).lower()
        for bad in ("per_patient_commission", "referral_volume_bonus", "commission_per_referral"):
            if bad in text:
                fail(f"{rel} contains unethical incentive pattern: {bad}")


def check_otp_validation_exists() -> None:
    serializers_file = read("shaasthi-api/accounts/serializers.py")
    if "OTPChallenge" not in serializers_file or "is_valid" not in serializers_file:
        fail("OTPChallenge validation missing in accounts serializers")


def main() -> int:
    check_aadhaar_schema()
    check_no_fetal_sex()
    check_incentive_ethics()
    check_otp_validation_exists()
    if FAILURES:
        for f in FAILURES:
            print(f"FAIL {f}")
        return 1
    print("PASS all compliance checks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
