"""Run risk engine smoke checks (dev/CI). Usage: python manage.py verify_risk_engine"""

from django.core.management.base import BaseCommand
from django.utils import timezone

from registry.models import Patient
from risk_engine.engine import RiskEngine
from risk_engine.models import RiskRule
from surveys.models import SurveyResponse


class Command(BaseCommand):
    help = "Verify risk engine scoring paths (hard flag + weighted)"

    def handle(self, *args, **options):
        errors = []

        active = RiskRule.objects.filter(is_active=True)
        if active.count() < 10:
            errors.append(f"Expected >=10 active rules, got {active.count()} (run seed_risk_rules)")
        if active.filter(is_hard_flag=True).count() < 4:
            errors.append("Expected >=4 hard-flag rules in seed")

        patient = Patient.objects.create(
            full_name="Verify Patient",
            gender="female",
            village="audit",
            metadata={"diabetes": True, "pregnancy_status": True},
            date_of_birth="1998-01-01",
        )
        survey = SurveyResponse.objects.create(
            patient=patient,
            survey_type="screening",
            answers={
                "fever": True,
                "cough": True,
                "cough_duration_weeks": 3,
                "reduced_fetal_movement": True,
            },
            submitted_at=timezone.now(),
        )

        engine = RiskEngine()
        hard_result = engine.evaluate(patient, survey)
        if not hard_result.triggered_by_hard_flag:
            errors.append("Hard-flag path: reduced_fetal_movement should short-circuit")
        elif hard_result.normalized_score != 100:
            errors.append(f"Hard-flag normalized_score expected 100, got {hard_result.normalized_score}")

        survey2 = SurveyResponse.objects.create(
            patient=patient,
            survey_type="screening",
            answers={"fever": True, "cough": True, "cough_duration_weeks": 3},
        )
        score_result = engine.evaluate(patient, survey2)
        if score_result.triggered_by_hard_flag:
            errors.append("Weighted path should not trigger hard flag on fever-only survey")
        if score_result.total_score < 4:
            errors.append(f"Weighted path score too low: {score_result.total_score}")

        assessment = engine.create_assessment(patient, survey2, save=True)
        if not assessment.rules_snapshot:
            errors.append("rules_snapshot empty on saved assessment")
        if not assessment.explanations or "actual_value" not in assessment.explanations[0]:
            errors.append("explanations missing actual_value audit field")

        if errors:
            for err in errors:
                self.stderr.write(self.style.ERROR(f"FAIL: {err}"))
            raise SystemExit(1)

        self.stdout.write(
            self.style.SUCCESS(
                f"Risk engine OK — hard_flag={hard_result.triggered_by_hard_flag}, "
                f"weighted_score={score_result.total_score}, level={score_result.level}, "
                f"rules={active.count()}"
            )
        )
