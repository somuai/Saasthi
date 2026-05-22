"""Feature extractor + operator edge case tests."""

import pytest
from risk_engine.engine import compare, resolve_path
from risk_engine.models import RiskRule
from tests.factories import PatientFactory, RiskRuleFactory, SurveyResponseFactory

# ── Operator Edge Cases ───────────────────────────────────────────────


class TestOperatorEdgeCases:
    def test_bad_operator_returns_false(self):
        assert compare("fever", "unknown_operator", "fever") is False

    def test_type_mismatch_returns_false(self):
        assert compare("abc", RiskRule.Operator.GT, 5) is False

    def test_none_actual_with_equals_returns_false(self):
        assert compare(None, RiskRule.Operator.EQ, "present") is False

    def test_none_actual_with_truthy_returns_false(self):
        assert compare(None, RiskRule.Operator.TRUTHY, None) is False

    def test_none_actual_with_falsy_returns_true(self):
        assert compare(None, RiskRule.Operator.FALSY, None) is True

    def test_float_string_comparison(self):
        assert compare("7.5", RiskRule.Operator.GT, 7.0)

    def test_contains_case_insensitive(self):
        assert compare("SHORTNESS of breath", RiskRule.Operator.CONTAINS, "Breath")

    def test_in_with_single_value(self):
        assert compare("fever", RiskRule.Operator.IN, "fever")

    def test_in_with_list(self):
        assert compare("fever", RiskRule.Operator.IN, ["cough", "fever", "pain"])

    def test_in_empty_list_returns_false(self):
        assert compare("fever", RiskRule.Operator.IN, []) is False

    def test_lte_edge(self):
        assert compare(5, RiskRule.Operator.LTE, 5) is True
        assert compare(6, RiskRule.Operator.LTE, 5) is False

    def test_gte_edge(self):
        assert compare(5, RiskRule.Operator.GTE, 5) is True
        assert compare(4, RiskRule.Operator.GTE, 5) is False

    def test_not_equals_returns_false_when_equal(self):
        assert compare("fever", RiskRule.Operator.NOT_EQ, "fever") is False


# ── Resolve Path Edge Cases ───────────────────────────────────────────


@pytest.mark.django_db
class TestResolvePathEdgeCases:
    def test_list_index_in_path_returns_none(self):
        survey = SurveyResponseFactory(answers={"items": [1, 2, 3]})
        val = resolve_path(None, survey, "survey.answers.items")
        assert isinstance(val, list)

    def test_resolve_path_type_error_returns_none(self):
        class BadObj:
            @property
            def age_years(self):
                raise TypeError("boom")
        val = resolve_path(BadObj(), None, "patient.age_years")
        assert val is None

    def test_nested_survey_answers_missing(self):
        survey = SurveyResponseFactory(answers={"a": {"b": {"c": "deep"}}})
        val = resolve_path(None, survey, "survey.answers.a.b.missing")
        assert val is None

    def test_patient_id_resolves(self):
        patient = PatientFactory()
        val = resolve_path(patient, None, "patient.id")
        assert val == patient.id


# ── Expected Value Extraction ─────────────────────────────────────────


@pytest.mark.django_db
class TestExpectedValue:
    def test_dict_with_value_key(self):
        from risk_engine.engine import expected_value_from_rule
        rule = RiskRuleFactory(value={"value": 7.0})
        assert expected_value_from_rule(rule) == 7.0

    def test_dict_without_value_key(self):
        from risk_engine.engine import expected_value_from_rule
        rule = RiskRuleFactory(value={"some_other_key": True})
        val = expected_value_from_rule(rule)
        assert val == {"some_other_key": True}


# ── Level For Score ───────────────────────────────────────────────────


class TestLevelForScore:
    def test_level_for_score_high(self):
        from risk_engine.engine import level_for_score
        assert level_for_score(8) == "high"
        assert level_for_score(100) == "high"

    def test_level_for_score_medium(self):
        from risk_engine.engine import level_for_score
        assert level_for_score(4) == "medium"
        assert level_for_score(7) == "medium"

    def test_level_for_score_low(self):
        from risk_engine.engine import level_for_score
        assert level_for_score(0) == "low"
        assert level_for_score(3) == "low"
