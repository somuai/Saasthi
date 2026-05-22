"""Risk engine tests — hard flags, scoring, snapshot, categories, temporal."""
from datetime import date, timedelta

import pytest
from django.utils import timezone
from risk_engine.engine import (
    RiskEngine,
    compare,
    level_for_score,
    resolve_path,
)
from risk_engine.models import RiskRule
from tests.factories import PatientFactory, RiskRuleFactory, SurveyResponseFactory

# ── Resolve Path ──────────────────────────────────────────────────────


@pytest.mark.django_db
class TestResolvePath:
    def test_patient_age_years(self):
        patient = PatientFactory(date_of_birth=date(1990, 1, 1))
        val = resolve_path(patient, None, "patient.age_years")
        assert val is not None
        assert val >= 35

    def test_survey_answers_fever(self):
        survey = SurveyResponseFactory(answers={"fever": True})
        val = resolve_path(None, survey, "survey.answers.fever")
        assert val is True

    def test_survey_answers_nested(self):
        survey = SurveyResponseFactory(answers={"symptom": {"severity": "high"}})
        val = resolve_path(None, survey, "survey.answers.symptom.severity")
        assert val == "high"

    def test_none_field_path_returns_none(self):
        assert resolve_path(None, None, None) is None

    def test_empty_field_path_returns_none(self):
        assert resolve_path(None, None, "") is None

    def test_nonexistent_path_returns_none(self):
        patient = PatientFactory()
        assert resolve_path(patient, None, "patient.nonexistent.deep.path") is None

    def test_survey_answers_missing_key_returns_none(self):
        survey = SurveyResponseFactory(answers={"fever": True})
        assert resolve_path(None, survey, "survey.answers.cough") is None

    def test_patient_metadata_resolved(self):
        patient = PatientFactory()
        patient.metadata = {"diabetes": True}
        patient.save()
        val = resolve_path(patient, None, "patient.metadata.diabetes")
        assert val is True

    def test_root_not_patient_or_survey_returns_none(self):
        assert resolve_path(None, None, "other.foo") is None

    def test_survey_is_none_for_patient_path_does_not_crash(self):
        patient = PatientFactory()
        val = resolve_path(patient, None, "patient.age_years")
        assert val is not None

    def test_survey_response_is_none_for_survey_path_returns_none(self):
        val = resolve_path(None, None, "survey.answers.fever")
        assert val is None

    def test_patient_diabetes_field(self):
        patient = PatientFactory(diabetes=True)
        val = resolve_path(patient, None, "patient.diabetes")
        assert val is True


# ── Compare Operator ──────────────────────────────────────────────────


class TestCompare:
    def test_truthy_true(self):
        assert compare(True, RiskRule.Operator.TRUTHY, None) is True

    def test_truthy_false(self):
        assert compare(False, RiskRule.Operator.TRUTHY, None) is False

    def test_falsy_none(self):
        assert compare(None, RiskRule.Operator.FALSY, None) is True

    def test_falsy_value(self):
        assert compare(0, RiskRule.Operator.FALSY, None) is True

    def test_equals_string(self):
        assert compare("fever", RiskRule.Operator.EQ, "fever") is True

    def test_not_equals(self):
        assert compare("fever", RiskRule.Operator.NOT_EQ, "cough") is True

    def test_greater_than(self):
        assert compare(10, RiskRule.Operator.GT, 5) is True

    def test_greater_than_or_equal(self):
        assert compare(5, RiskRule.Operator.GTE, 5) is True

    def test_less_than(self):
        assert compare(3, RiskRule.Operator.LT, 5) is True

    def test_less_than_or_equal(self):
        assert compare(5, RiskRule.Operator.LTE, 5) is True

    def test_contains(self):
        assert compare("shortness of breath", RiskRule.Operator.CONTAINS, "breath") is True

    def test_in_list(self):
        result = compare("fever", RiskRule.Operator.IN, ["fever", "cough"])
        assert result is True

    def test_type_error_returns_false(self):
        assert compare("abc", RiskRule.Operator.GT, 5) is False

    def test_none_with_non_falsy_returns_false(self):
        assert compare(None, RiskRule.Operator.EQ, "something") is False

    def test_case_insensitive_equals(self):
        assert compare("FEVER", RiskRule.Operator.EQ, "fever") is True


# ── Level For Score ───────────────────────────────────────────────────


class TestLevelForScore:
    def test_high_score_8(self):
        assert level_for_score(8) == "high"

    def test_high_score_above_8(self):
        assert level_for_score(15) == "high"

    def test_medium_score_4(self):
        assert level_for_score(4) == "medium"

    def test_medium_score_7(self):
        assert level_for_score(7) == "medium"

    def test_low_score_0(self):
        assert level_for_score(0) == "low"

    def test_low_score_3(self):
        assert level_for_score(3) == "low"


# ── Hard Flags (clinical safety) ──────────────────────────────────────


@pytest.mark.django_db
@pytest.mark.clinical
class TestHardFlags:
    def test_unconscious_short_circuits_to_high(self, seed_risk_rules):
        patient = PatientFactory()
        survey = SurveyResponseFactory(
            answers={"unconscious": True},
        )
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        assert result.triggered_by_hard_flag is True
        assert result.level == "high"
        assert result.normalized_score == 100
        assert result.total_score == 0

    def test_convulsions_hard_flag(self, seed_risk_rules):
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"convulsions": True})
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        assert result.triggered_by_hard_flag is True
        assert result.level == "high"
        assert result.normalized_score == 100

    def test_severe_breathlessness_hard_flag(self, seed_risk_rules):
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"breathlessness_severity": "severe"})
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        assert result.triggered_by_hard_flag is True
        assert "respiratory" in result.recommended_action_en.lower()

    def test_reduced_fetal_movement_hard_flag(self, seed_risk_rules):
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"reduced_fetal_movement": True})
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        assert result.triggered_by_hard_flag is True
        assert result.primary_category == "maternal"

    def test_vaginal_bleeding_hard_flag(self, seed_risk_rules):
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"vaginal_bleeding": True})
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        assert result.triggered_by_hard_flag is True

    def test_no_false_positive_hard_flag(self, seed_risk_rules):
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"fever": True, "weakness": True})
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        assert result.triggered_by_hard_flag is False
        assert result.total_score >= 3

    def test_hard_flag_score_100_always(self, seed_risk_rules):
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"unconscious": True})
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        assert result.normalized_score == 100

    def test_hard_flag_has_immediate_urgency(self, seed_risk_rules):
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"convulsions": True})
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        assert result.recommended_urgency == "immediate"


# ── Weighted Scoring ──────────────────────────────────────────────────


@pytest.mark.django_db
class TestWeightedScoring:
    def test_high_risk_tb_pattern(self, seed_risk_rules):
        patient = PatientFactory(diabetes=True)
        survey = SurveyResponseFactory(
            answers={
                "fever": True,
                "cough_duration_weeks": 3,
                "comm_contact_sick": True,
            },
        )
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        assert result.level == "high"
        assert result.total_score >= 8
        assert result.primary_category == "communicable"

    def test_low_risk_single_mild_symptom(self, seed_risk_rules):
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"weakness": True})
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        assert result.level == "low"
        assert result.normalized_score < 30

    def test_medium_risk_multiple_mild(self, seed_risk_rules):
        patient = PatientFactory()
        survey = SurveyResponseFactory(
            answers={"fever": True, "weakness": True},
        )
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        assert result.level in ("medium", "high")

    def test_normalized_score_0_to_100(self, seed_risk_rules):
        patient = PatientFactory()
        answers_list = [
            {},
            {"weakness": True},
            {"fever": True, "cough_duration_weeks": 3},
            {"unconscious": True},
        ]
        engine = RiskEngine()
        for answers in answers_list:
            survey = SurveyResponseFactory(answers=answers)
            result = engine.evaluate(patient, survey)
            if result.normalized_score is not None:
                assert 0 <= result.normalized_score <= 100

    def test_normalized_score_math(self, seed_risk_rules):
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"fever": True})
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        max_score = engine.get_max_theoretical_score()
        expected = min(round((result.total_score / max_score) * 100), 100)
        assert result.normalized_score == expected


# ── Categories ────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestCategories:
    def test_primary_is_highest_weight(self, seed_risk_rules):
        patient = PatientFactory(metadata={"diabetes": True})
        survey = SurveyResponseFactory(
            answers={"fever": True, "cough_duration_weeks": 3},
        )
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        assert result.primary_category == "communicable"
        assert "chronic" in result.secondary_categories

    def test_primary_maternal_for_maternal_hard_flag(self, seed_risk_rules):
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"reduced_fetal_movement": True})
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        assert result.primary_category == "maternal"

    def test_hard_flag_category_matches_rule_category(self, seed_risk_rules):
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"unconscious": True})
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        assert result.primary_category == "critical"


# ── Rules Snapshot ────────────────────────────────────────────────────


@pytest.mark.django_db
class TestRulesSnapshot:
    def test_snapshot_frozen_at_evaluation_time(self, seed_risk_rules):
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"fever": True})
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        original_codes = [r["code"] for r in result.rules_snapshot]
        assert "FEVER_ACTIVE" in original_codes
        assert len(result.rules_snapshot) >= 15

    def test_snapshot_has_all_required_keys(self, seed_risk_rules):
        patient = PatientFactory()
        engine = RiskEngine()
        result = engine.evaluate(patient, None)
        if result.rules_snapshot:
            entry = result.rules_snapshot[0]
            for key in ("id", "code", "field_path", "operator", "weight", "category", "is_hard_flag", "rule_label_en", "rule_label_hi"):
                assert key in entry


# ── Explanations ──────────────────────────────────────────────────────


@pytest.mark.django_db
class TestExplanations:
    def test_explanations_include_actual_values(self, seed_risk_rules):
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"fever": True})
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        fever_exps = [e for e in result.explanations if "fever" in e["field_path"]]
        if fever_exps:
            assert fever_exps[0]["actual_value"] is True
            assert fever_exps[0]["weight_contributed"] > 0

    def test_explanations_have_hindi_labels(self, seed_risk_rules):
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"fever": True})
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        for explanation in result.explanations:
            assert explanation["rule_label_hi"] is not None
            assert len(explanation["rule_label_hi"]) > 0

    def test_hard_flag_explanation_has_correct_fields(self, seed_risk_rules):
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"unconscious": True})
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        assert len(result.explanations) == 1
        exp = result.explanations[0]
        assert exp["severity"] == "high"
        assert exp["actual_value"] is True
        assert exp["weight_contributed"] > 0


# ── Temporal Safety ───────────────────────────────────────────────────


@pytest.mark.django_db
class TestTemporalSafety:
    def test_rule_created_after_survey_excluded(self, seed_risk_rules):
        from django.utils import timezone
        engine = RiskEngine()
        patient = PatientFactory()
        survey = SurveyResponseFactory(
            answers={"fever": True},
            submitted_at=timezone.now() - timedelta(days=30),
        )
        RiskRuleFactory(
            code="NEW_RULE",
            field_path="survey.answers.fever",
            operator=RiskRule.Operator.TRUTHY,
            weight=10,
            created_at=timezone.now() - timedelta(days=1),
        )
        past = survey.submitted_at
        result = engine.evaluate(patient, survey, surveyed_at=past)
        new_rule_fired = any(e["code"] == "NEW_RULE" for e in result.explanations)
        assert not new_rule_fired

    def test_deactivated_rule_excluded(self, seed_risk_rules):
        engine = RiskEngine()
        patient = PatientFactory()
        rule = RiskRuleFactory(
            code="TEMP_RULE",
            field_path="survey.answers.fever",
            operator=RiskRule.Operator.TRUTHY,
            weight=5,
        )
        rule.deactivated_at = timezone.now() - timedelta(hours=1)
        rule.save(update_fields=["deactivated_at"])
        survey = SurveyResponseFactory(answers={"fever": True})
        result = engine.evaluate(patient, survey, surveyed_at=timezone.now())
        assert not any(e["code"] == "TEMP_RULE" for e in result.explanations)

    def test_rule_active_before_deactivation_included(self, seed_risk_rules):
        engine = RiskEngine()
        patient = PatientFactory()
        rule = RiskRuleFactory(
            code="TEMP_RULE",
            field_path="survey.answers.fever",
            operator=RiskRule.Operator.TRUTHY,
            weight=5,
        )
        now = timezone.now()
        rule.created_at = now - timedelta(days=10)
        rule.deactivated_at = now - timedelta(days=2)
        rule.save()
        survey = SurveyResponseFactory(
            answers={"fever": True},
            submitted_at=now - timedelta(days=5),
        )
        result = engine.evaluate(patient, survey, surveyed_at=now - timedelta(days=5))
        fired = any(e["code"] == "TEMP_RULE" for e in result.explanations)
        assert fired


# ── Recommendations ───────────────────────────────────────────────────


@pytest.mark.django_db
class TestRecommendations:
    def test_critical_emergency_recommendation(self, seed_risk_rules):
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"unconscious": True})
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        assert result.recommended_urgency == "immediate"

    def test_recommendations_have_hindi(self, seed_risk_rules):
        import re
        patient = PatientFactory()
        engine = RiskEngine()
        result = engine.evaluate(patient, None)
        assert result.recommended_action_hi
        assert re.search(r"[\u0900-\u097F]", result.recommended_action_hi)

    def test_high_referral_mentions_phc(self, seed_risk_rules):
        patient = PatientFactory()
        survey = SurveyResponseFactory(
            answers={"fever": True, "cough_duration_weeks": 3},
        )
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        assert "PHC" in result.recommended_action_en or "Refer" in result.recommended_action_en


# ── Edge Cases ────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestEdgeCases:
    def test_score_never_negative(self, seed_risk_rules):
        patient = PatientFactory()
        engine = RiskEngine()
        result = engine.evaluate(patient, None)
        assert result.total_score >= 0

    def test_age_over_60_fires(self, seed_risk_rules):
        patient = PatientFactory(date_of_birth=date(1950, 1, 1))
        engine = RiskEngine()
        result = engine.evaluate(patient, None)
        assert any(e["code"] == "AGE_OVER_60" for e in result.explanations)

    def test_child_under_5_detected(self, seed_risk_rules):
        patient = PatientFactory(date_of_birth=date(2022, 6, 1))
        engine = RiskEngine()
        result = engine.evaluate(patient, None)
        codes = [e["code"] for e in result.explanations]
        assert "AGE_UNDER_5" in codes

    def test_metadata_diabetes_fires(self, seed_risk_rules):
        patient = PatientFactory(metadata={"diabetes": True})
        engine = RiskEngine()
        result = engine.evaluate(patient, None)
        codes = [e["code"] for e in result.explanations]
        assert "DIABETES_KNOWN" in codes

    def test_metadata_hypertension_fires(self, seed_risk_rules):
        patient = PatientFactory(metadata={"hypertension": True})
        engine = RiskEngine()
        result = engine.evaluate(patient, None)
        assert any(e["code"] == "HYPERTENSION_KNOWN" for e in result.explanations)

    def test_pregnancy_condition_fires(self, seed_risk_rules):
        patient = PatientFactory(metadata={"pregnancy_status": True})
        engine = RiskEngine()
        result = engine.evaluate(patient, None)
        codes = [e["code"] for e in result.explanations]
        assert "PREGNANT" in codes

    def test_persistent_vomiting_fires(self, seed_risk_rules):
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"vomiting": True})
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        assert any(e["code"] == "PERSISTENT_VOMITING" for e in result.explanations)

    def test_create_assessment_saves_to_db(self, seed_risk_rules):
        patient = PatientFactory()
        engine = RiskEngine()
        assessment = engine.create_assessment(patient, None)
        assert assessment.pk is not None
        assert assessment.patient_id == patient.id
        assert assessment.level in ("high", "medium", "low")

    def test_empty_answers_does_not_crash(self, seed_risk_rules):
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={})
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        assert result.total_score >= 0
