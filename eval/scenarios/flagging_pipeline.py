#!/usr/bin/env python3
import os
import sys

# Django setup for direct engine run
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "shaasthi_backend.settings")

import django

django.setup()

from flagging.models import Flag  # noqa: E402
from flagging.services import create_flags_for_assessment  # noqa: E402
from registry.models import Patient  # noqa: E402
from risk_engine.engine import assess  # noqa: E402
from risk_engine.models import RiskRule  # noqa: E402
from surveys.models import SurveyResponse  # noqa: E402


def main() -> int:
    pid = "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d"
    patient, _ = Patient.objects.update_or_create(
        local_uuid=pid,
        defaults={
            "full_name": "Flag Test",
        },
    )
    survey, _ = SurveyResponse.objects.update_or_create(
        local_uuid="b1c2d3e4-f5a6-4b5c-8d9e-0f1a2b3c4d5e",
        defaults={
            "patient": patient,
            "survey_type": "pilot",
            "answers": {"comm_cough_2weeks": True},
        },
    )

    # Ensure there is a rule that matches this
    RiskRule.objects.update_or_create(
        code="TB_COUGH_RISK",
        defaults={
            "name": "TB Cough Risk",
            "field_path": "survey.answers.comm_cough_2weeks",
            "operator": RiskRule.Operator.EQ,
            "value": True,
            "weight": 5,
            "severity": "high",
            "flag_type": "TB_RISK",
            "is_active": True,
        }
    )

    Flag.objects.filter(patient=patient, flag_type="TB_RISK").delete()

    # Run new assessment
    assessment_dict = assess(patient, survey)

    # Mock an assessment object for create_flags_for_assessment
    class MockAssessment:
        def __init__(self, data, patient):
            self.patient = patient
            self.explanations = data["explanations"]
            self.level = data["level"]
            self.total_score = data["total_score"]
            self.local_uuid = "eval-assessment-1"

    assessment = MockAssessment(assessment_dict, patient)
    created_flags = create_flags_for_assessment(assessment)

    if len(created_flags) < 1 and not Flag.objects.filter(patient=patient, flag_type="TB_RISK").exists():
        print("FAIL flagging did not create TB_RISK")
        return 1
    print("PASS flagging_pipeline", assessment_dict)
    return 0


if __name__ == "__main__":
    sys.exit(main())
