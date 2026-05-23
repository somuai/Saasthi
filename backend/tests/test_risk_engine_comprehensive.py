"""Comprehensive risk engine validation — every critical path."""

from datetime import timedelta

import pytest
from django.utils import timezone
from registry.models import Patient
from risk_engine.engine import RiskEngine, assess
from risk_engine.models import RiskRule
from surveys.models import SurveyResponse


@pytest.fixture(autouse=True)
def seed_rules():
    """Ensure all 25 seed rules exist before each test."""
    from django.core.management import call_command

    call_command("seed_risk_rules")


@pytest.mark.django_db
class TestHardFlags:
    """Section 8A — hard flags must short-circuit to HIGH with normalized_score=100."""

    def test_hard_flag_unconscious(self):
        engine = RiskEngine()
        patient = Patient.objects.create(full_name="Test", gender="male")
        survey = SurveyResponse.objects.create(
            patient=patient,
            survey_type="screening",
            answers={"unconscious": True},
        )
        result = engine.evaluate(patient, survey)
        assert result.triggered_by_hard_flag is True
        assert result.level == "high"
        assert result.normalized_score == 100
        assert result.total_score == 0  # No weighted scoring
        assert result.recommendation_source != ""
        assert result.score_source == "rule_engine"

    def test_hard_flag_convulsions(self):
        engine = RiskEngine()
        patient = Patient.objects.create(full_name="Test", gender="male")
        survey = SurveyResponse.objects.create(
            patient=patient,
            survey_type="screening",
            answers={"convulsions": True},
        )
        result = engine.evaluate(patient, survey)
        assert result.triggered_by_hard_flag is True
        assert result.level == "high"
        assert result.normalized_score == 100

    def test_hard_flag_severe_breathlessness(self):
        engine = RiskEngine()
        patient = Patient.objects.create(full_name="Test", gender="female")
        survey = SurveyResponse.objects.create(
            patient=patient,
            survey_type="screening",
            answers={"breathlessness_severity": "severe"},
        )
        result = engine.evaluate(patient, survey)
        assert result.triggered_by_hard_flag is True
        assert "respiratory" in result.recommended_action_en.lower()

    def test_hard_flag_reduced_fetal_movement(self):
        engine = RiskEngine()
        patient = Patient.objects.create(full_name="Test", gender="female")
        survey = SurveyResponse.objects.create(
            patient=patient,
            survey_type="screening",
            answers={"reduced_fetal_movement": True},
        )
        result = engine.evaluate(patient, survey)
        assert result.triggered_by_hard_flag is True
        assert result.primary_category == "maternal"

    def test_hard_flag_vaginal_bleeding(self):
        engine = RiskEngine()
        patient = Patient.objects.create(full_name="Test", gender="female")
        survey = SurveyResponse.objects.create(
            patient=patient,
            survey_type="screening",
            answers={"vaginal_bleeding": True},
        )
        result = engine.evaluate(patient, survey)
        assert result.triggered_by_hard_flag is True

    def test_hard_flag_severe_dehydration(self):
        engine = RiskEngine()
        patient = Patient.objects.create(full_name="Test", gender="male")
        survey = SurveyResponse.objects.create(
            patient=patient,
            survey_type="screening",
            answers={"severe_dehydration": True},
        )
        result = engine.evaluate(patient, survey)
        assert result.triggered_by_hard_flag is True

    def test_no_false_positive_hard_flag(self):
        """Without any hard-flag triggers, normal scoring runs."""
        engine = RiskEngine()
        patient = Patient.objects.create(full_name="Test", gender="male")
        survey = SurveyResponse.objects.create(
            patient=patient,
            survey_type="screening",
            answers={"fever": True, "weakness": True},
        )
        result = engine.evaluate(patient, survey)
        assert result.triggered_by_hard_flag is False
        assert result.total_score >= 3  # fever(3) + weakness(1) = 4
        assert result.normalized_score < 100


@pytest.mark.django_db
class TestWeightedScoring:
    """Section 8A — weighted scoring, normalization, categories, explanations."""

    def test_high_risk_communicable(self):
        """fever(3) + cough_2w(4) + contact_sick(3) = 10 → high."""
        patient = Patient.objects.create(full_name="Test", gender="female")
        survey = SurveyResponse.objects.create(
            patient=patient,
            survey_type="screening",
            answers={
                "fever": True,
                "cough_duration_weeks": 3,
                "comm_contact_sick": True,  # +3 to push over high threshold
            },
        )
        result = assess(patient, survey)
        assert result["total_score"] >= 8
        assert result["level"] == "high"
        assert result["primary_category"] == "communicable"
        assert result["recommendation_source"] == "rule_template"
        assert result["score_source"] == "rule_engine"

    def test_medium_risk(self):
        patient = Patient.objects.create(full_name="Test", gender="male", metadata={"diabetes": True})
        result = assess(patient, None)
        assert result["level"] == "medium" or result["level"] == "low"
        assert result["normalized_score"] is not None

    def test_low_risk_healthy(self):
        patient = Patient.objects.create(full_name="Test", gender="female")
        survey = SurveyResponse.objects.create(
            patient=patient,
            survey_type="screening",
            answers={"weakness": True},
        )
        result = assess(patient, survey)
        assert result["level"] == "low"
        assert result["total_score"] == 1

    def test_normalized_score_math(self):
        """Verify normalized_score = (raw / max_theoretical) * 100."""
        patient = Patient.objects.create(full_name="Test", gender="female")
        survey = SurveyResponse.objects.create(
            patient=patient,
            survey_type="screening",
            answers={"fever": True},
        )
        result = assess(patient, survey)
        max_score = RiskEngine().get_max_theoretical_score()
        expected_norm = min(round((result["total_score"] / max_score) * 100), 100)
        assert result["normalized_score"] == expected_norm

    def test_primary_category_highest_weight(self):
        """The category with the highest cumulative weight becomes primary."""
        patient = Patient.objects.create(
            full_name="Test",
            gender="female",
            metadata={"diabetes": True},
        )
        survey = SurveyResponse.objects.create(
            patient=patient,
            survey_type="screening",
            answers={"fever": True, "cough_duration_weeks": 3},
        )
        result = assess(patient, survey)
        # communicable: fever(3) + cough_2w(4) = 7
        # chronic: diabetes(3) = 3
        assert result["primary_category"] == "communicable"
        assert "chronic" in result["secondary_categories"]

    def test_explanations_include_actual_values(self):
        patient = Patient.objects.create(full_name="Test", gender="female")
        survey = SurveyResponse.objects.create(
            patient=patient,
            survey_type="screening",
            answers={"fever": True},
        )
        result = assess(patient, survey)
        assert len(result["explanations"]) >= 1
        assert "actual_value" in result["explanations"][0]
        assert result["explanations"][0]["actual_value"] is True

    def test_rules_snapshot_frozen_at_eval_time(self):
        """rules_snapshot should contain all active rules at time of evaluation."""
        patient = Patient.objects.create(full_name="Test", gender="female")
        survey = SurveyResponse.objects.create(
            patient=patient,
            survey_type="screening",
            answers={"fever": True},
        )
        result = assess(patient, survey)
        assert len(result["rules_snapshot"]) >= 15
        snapshot_codes = [r["code"] for r in result["rules_snapshot"]]
        assert "FEVER_ACTIVE" in snapshot_codes


@pytest.mark.django_db
class TestTemporalRules:
    """Section 8A — as-of timestamps for offline replay safety."""

    def test_rule_created_after_survey_excluded(self):
        """A rule created AFTER the surveyed_at time should NOT fire."""
        from django.utils import timezone

        engine = RiskEngine()
        patient = Patient.objects.create(full_name="Test", gender="female")
        survey = SurveyResponse.objects.create(
            patient=patient,
            survey_type="screening",
            answers={"fever": True},
            submitted_at=timezone.now() - timedelta(days=30),
        )
        # Create a new rule AFTER the survey was submitted
        RiskRule.objects.create(
            code="NEW_RULE",
            name="New",
            field_path="survey.answers.fever",
            operator=RiskRule.Operator.TRUTHY,
            weight=10,
            created_at=timezone.now() - timedelta(days=1),
        )
        # Evaluate with surveyed_at before the new rule was created
        past = survey.submitted_at
        result = engine.evaluate(patient, survey, surveyed_at=past)
        new_rule_fired = any(e["code"] == "NEW_RULE" for e in result.explanations)
        assert not new_rule_fired, "New rule created after surveyed_at should not fire"

    def test_deactivated_rule_excluded(self):
        engine = RiskEngine()
        patient = Patient.objects.create(full_name="Test", gender="female")
        rule = RiskRule.objects.create(
            code="TEMP_RULE",
            name="Temp",
            field_path="survey.answers.fever",
            operator=RiskRule.Operator.TRUTHY,
            weight=5,
        )
        rule.deactivated_at = timezone.now() - timedelta(hours=1)
        rule.save(update_fields=["deactivated_at"])
        survey = SurveyResponse.objects.create(
            patient=patient,
            survey_type="screening",
            answers={"fever": True},
        )
        result = engine.evaluate(patient, survey, surveyed_at=timezone.now())
        assert not any(e["code"] == "TEMP_RULE" for e in result.explanations)


@pytest.mark.django_db
class TestRecommendations:
    """Section 8C — recommendation templates and urgency levels."""

    def test_critical_emergency_recommendation(self):
        engine = RiskEngine()
        patient = Patient.objects.create(full_name="Test", gender="male")
        survey = SurveyResponse.objects.create(
            patient=patient,
            survey_type="screening",
            answers={"unconscious": True},
        )
        result = engine.evaluate(patient, survey)
        assert result.recommended_urgency == "immediate"
        assert "108" in result.recommended_action_en

    def test_high_referral_recommendation(self):
        patient = Patient.objects.create(full_name="Test", gender="female")
        survey = SurveyResponse.objects.create(
            patient=patient,
            survey_type="screening",
            answers={"fever": True, "cough_duration_weeks": 3},
        )
        result = assess(patient, survey)
        assert "PHC" in result["recommended_action_en"] or "Refer" in result["recommended_action_en"]

    def test_routine_recommendation(self):
        patient = Patient.objects.create(full_name="Test", gender="female")
        survey = SurveyResponse.objects.create(
            patient=patient,
            survey_type="screening",
            answers={"weakness": True},
        )
        result = assess(patient, survey)
        assert result["recommended_urgency"] == "routine" or result["recommended_urgency"] == "within_3_days"

    def test_recommendations_have_hindi(self):
        """All recommendation templates MUST have Hindi translations."""
        patient = Patient.objects.create(full_name="Test", gender="female")
        result = assess(patient, None)
        assert result["recommended_action_hi"], "Hindi recommendation should not be empty"
        # Check Devanagari characters
        import re

        assert re.search(r"[\u0900-\u097F]", result["recommended_action_hi"])


@pytest.mark.django_db
class TestSeedData:
    """Section 15A — verify seed rules are complete."""

    def test_all_seed_rules_present(self):
        active = RiskRule.objects.filter(is_active=True)
        assert active.count() >= 20, f"Expected >= 20 active rules, got {active.count()}"

    def test_all_categories_present(self):
        categories = set(RiskRule.objects.filter(is_active=True).values_list("category", flat=True))
        expected = {"communicable", "chronic", "critical", "maternal", "general"}
        assert expected.issubset(categories), f"Missing categories: {expected - categories}"

    def test_all_hard_flags_present(self):
        hf = RiskRule.objects.filter(is_active=True, is_hard_flag=True)
        assert hf.count() >= 5, f"Expected >= 5 hard flags, got {hf.count()}"
        codes = set(hf.values_list("code", flat=True))
        for required in [
            "HF_UNCONSCIOUS",
            "HF_CONVULSIONS",
            "HF_SEVERE_BREATH",
            "HF_FETAL_MOVEMENT",
            "HF_VAGINAL_BLEEDING",
        ]:
            assert required in codes, f"Missing hard flag: {required}"

    def test_all_labels_have_hindi(self):
        no_hi = RiskRule.objects.filter(is_active=True).filter(rule_label_hi="").exclude(is_hard_flag=True)
        assert no_hi.count() == 0, f"Rules missing Hindi labels: {list(no_hi.values('code'))}"


@pytest.mark.django_db
class TestEdgeCases:
    """Boundary and resilience edge cases."""

    def test_score_never_negative(self):
        patient = Patient.objects.create(full_name="Test", gender="male")
        result = assess(patient, None)
        assert result["total_score"] >= 0
        assert result["normalized_score"] is None or result["normalized_score"] >= 0

    def test_age_based_rules(self):
        from datetime import date

        patient = Patient.objects.create(full_name="Elderly", gender="male")
        patient.date_of_birth = date(1950, 1, 1)
        patient.save()
        result = assess(patient, None)
        assert result["total_score"] >= 2  # AGE_OVER_60 fires

    def test_diabetes_from_metadata(self):
        patient = Patient.objects.create(
            full_name="DM",
            gender="female",
            metadata={"diabetes": True},
        )
        result = assess(patient, None)
        assert any(e["code"] == "DIABETES_KNOWN" for e in result["explanations"])

    def test_hypertension_from_metadata(self):
        patient = Patient.objects.create(
            full_name="HTN",
            gender="female",
            metadata={"hypertension": True},
        )
        result = assess(patient, None)
        assert any(e["code"] == "HYPERTENSION_KNOWN" for e in result["explanations"])

    def test_pregnancy_condition_rules(self):
        patient = Patient.objects.create(
            full_name="Preg",
            gender="female",
            metadata={"pregnancy_status": True},
        )
        result = assess(patient, None)
        assert any(e["code"] == "PREGNANT" for e in result["explanations"])

    def test_imci_child_under_5(self):
        from datetime import date

        patient = Patient.objects.create(full_name="Child", gender="male")
        patient.date_of_birth = date(2022, 6, 1)
        patient.save()
        result = assess(patient, None)
        codes = [e["code"] for e in result["explanations"]]
        assert "AGE_UNDER_5" in codes

    def test_persistent_vomiting(self):
        patient = Patient.objects.create(full_name="Test", gender="male")
        survey = SurveyResponse.objects.create(
            patient=patient,
            survey_type="screening",
            answers={"vomiting": True},
        )
        result = assess(patient, survey)
        assert any(e["code"] == "PERSISTENT_VOMITING" for e in result["explanations"])
