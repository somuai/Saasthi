#!/usr/bin/env python3
import os
import sys

# Django setup for direct engine run
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "medilift-api"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

import django

django.setup()

from apps.flagging.engine import FlaggingEngine
from apps.patients.models import Flag, Patient, SurveyResponse
from apps.sync_api.registry import now_ms


def main() -> int:
    ts = now_ms()
    pid = "eval-flag-patient"
    Patient.objects.update_or_create(
        id=pid,
        defaults={
            "patient_code": "EVAL-FLAG",
            "name": "Flag Test",
            "risk_level": "low",
            "risk_score": 5,
            "is_synced": True,
            "created_at": ts,
            "updated_at": ts,
            "is_deleted": False,
            "is_mock": True,
        },
    )
    SurveyResponse.objects.update_or_create(
        id="eval-flag-survey",
        defaults={
            "patient_id": pid,
            "survey_date": "2026-05-18",
            "payload_json": {"comm_cough_2weeks": True},
            "is_synced": True,
            "created_at": ts,
            "updated_at": ts,
            "is_deleted": False,
            "is_mock": True,
        },
    )
    Flag.objects.filter(patient_id=pid, flag_type="TB_RISK").delete()
    result = FlaggingEngine().flag_tb_risk()
    if result.get("created", 0) < 1 and not Flag.objects.filter(patient_id=pid, flag_type="TB_RISK").exists():
        print("FAIL flagging did not create TB_RISK")
        return 1
    print("PASS flagging_pipeline", result)
    return 0


if __name__ == "__main__":
    sys.exit(main())
