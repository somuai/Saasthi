"""Safety-critical audit tests for risk engine — hard flags, normalization, snapshot immutability."""

import pytest
from risk_engine.engine import RiskEngine, resolve_path
from risk_engine.models import RiskAssessment, RiskRule

from tests.factories import PatientFactory, RiskRuleFactory, SurveyResponseFactory

# ── CHECK 1: Hard Flag Short-Circuit Logic ────────────────────────────────


@pytest.mark.django_db
class TestHardFlagShortCircuit:
    """Verify hard flags return immediately without adding weight to score."""

    def test_hard_flag_returns_before_scoring_rules_evaluated(self):
        """Hard flag match should return immediately; scoring rules not evaluated."""
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"unconscious": True, "fever": True, "cough_duration_weeks": 5})

        # Create a hard flag rule
        hard_flag_rule = RiskRuleFactory(
            code="unconscious_hf",
            field_path="survey.answers.unconscious",
            operator=RiskRule.Operator.TRUTHY,
            value={},
            is_hard_flag=True,
            weight=999,  # Should NOT be added to score
            category=RiskRule.Category.CRITICAL,
        )

        engine = RiskEngine()
        result = engine.evaluate(patient, survey)

        assert result.triggered_by_hard_flag is True
        assert result.total_score == 0, "Hard flag weight should not contribute to score"
        assert result.hard_flag_rule_id == hard_flag_rule.id
        # Explanation should ONLY contain the hard flag, no scoring rules
        assert len(result.explanations) == 1
        assert result.explanations[0]["rule_id"] == hard_flag_rule.id

    def test_hard_flag_normalized_score_always_100(self):
        """Hard flag should set normalized_score to exactly 100."""
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"convulsions": True})

        RiskRuleFactory(
            code="convulsions_hf",
            field_path="survey.answers.convulsions",
            operator=RiskRule.Operator.TRUTHY,
            value={},
            is_hard_flag=True,
        )

        engine = RiskEngine()
        result = engine.evaluate(patient, survey)

        assert result.triggered_by_hard_flag is True
        assert result.normalized_score == 100, "Hard flag normalized score must be 100"
        assert result.level == "high"
        assert result.recommended_urgency == "immediate"

    def test_hard_flag_level_always_high_urgent_always_immediate(self):
        """Hard flag should set level=high and urgency=immediate."""
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"severe_breathlessness": True})

        RiskRuleFactory(
            code="severe_breathlessness_hf",
            field_path="survey.answers.severe_breathlessness",
            operator=RiskRule.Operator.TRUTHY,
            value={},
            is_hard_flag=True,
            hard_flag_message_en="EMERGENCY: Severe respiratory distress — refer to hospital immediately",
        )

        engine = RiskEngine()
        result = engine.evaluate(patient, survey)

        assert result.level == "high"
        assert result.recommended_urgency == "immediate"
        assert "EMERGENCY" in result.recommended_action_en or "immediate" in result.recommended_action_en.lower()

    def test_non_matching_hard_flag_continues_to_scoring(self):
        """Non-matching hard flag should not short-circuit; scoring rules evaluated."""
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"fever": True})  # No hard flag trigger

        RiskRuleFactory(
            code="unconscious_hf",
            field_path="survey.answers.unconscious",
            operator=RiskRule.Operator.TRUTHY,
            value={},
            is_hard_flag=True,
            weight=999,
        )

        scoring_rule = RiskRuleFactory(
            code="fever_score",
            field_path="survey.answers.fever",
            operator=RiskRule.Operator.TRUTHY,
            value={},
            is_hard_flag=False,
            weight=5,
        )

        engine = RiskEngine()
        result = engine.evaluate(patient, survey)

        assert result.triggered_by_hard_flag is False
        assert result.total_score == 5, "Only scoring rule should contribute"
        assert len(result.explanations) == 1
        assert result.explanations[0]["rule_id"] == scoring_rule.id


# ── CHECK 2: Field Path Resolver Robustness ────────────────────────────────


@pytest.mark.django_db
class TestResolvePathRobustness:
    """Verify field path resolver handles edge cases safely."""

    def test_empty_path_returns_none(self):
        """Empty string path should return None."""
        patient = PatientFactory()
        assert resolve_path(patient, None, "") is None

    def test_none_path_returns_none(self):
        """None path should return None."""
        patient = PatientFactory()
        assert resolve_path(patient, None, None) is None

    def test_nonexistent_patient_field_returns_none(self):
        """Nonexistent patient field should return None, not raise."""
        patient = PatientFactory()
        result = resolve_path(patient, None, "patient.nonexistent_field")
        assert result is None

    def test_deeply_nested_nonexistent_path_returns_none(self):
        """Deeply nested nonexistent path should return None safely."""
        patient = PatientFactory()
        result = resolve_path(patient, None, "patient.nonexistent.deep.nested.path")
        assert result is None

    def test_nonexistent_survey_key_returns_none(self):
        """Nonexistent survey answer key should return None."""
        survey = SurveyResponseFactory(answers={"fever": True})
        result = resolve_path(None, survey, "survey.answers.nonexistent_symptom")
        assert result is None

    def test_survey_none_for_survey_path_returns_none(self):
        """Survey path with survey=None should return None."""
        result = resolve_path(None, None, "survey.answers.fever")
        assert result is None

    def test_invalid_root_returns_none(self):
        """Invalid root (not patient or survey) should return None."""
        patient = PatientFactory()
        result = resolve_path(patient, None, "invalid_root.field")
        assert result is None

    def test_survey_answers_nested_dict_path(self):
        """Nested dict in survey answers should resolve correctly."""
        survey = SurveyResponseFactory(answers={"symptom": {"severity": "high", "duration": 3}})
        result = resolve_path(None, survey, "survey.answers.symptom.severity")
        assert result == "high"

    def test_survey_answers_missing_nested_dict_returns_none(self):
        """Missing nested dict key should return None, not raise."""
        survey = SurveyResponseFactory(answers={"symptom": {"severity": "high"}})
        result = resolve_path(None, survey, "survey.answers.symptom.nonexistent")
        assert result is None

    def test_patient_metadata_resolved_correctly(self):
        """Patient metadata should resolve correctly."""
        patient = PatientFactory()
        patient.metadata = {"diabetes": True, "custom": {"field": "value"}}
        patient.save()
        result = resolve_path(patient, None, "patient.metadata.diabetes")
        assert result is True

    def test_no_exception_on_type_error(self):
        """Type errors during path resolution should not raise."""
        survey = SurveyResponseFactory(answers={"number": 42})
        # Trying to access as dict when it's not
        result = resolve_path(None, survey, "survey.answers.number.invalid")
        assert result is None


# ── CHECK 3: Score Normalization Safety ────────────────────────────────────


@pytest.mark.django_db
class TestScoreNormalizationSafety:
    """Verify score normalization is safe and never exceeds 100 or causes division by zero."""

    def test_max_theoretical_score_queries_db_not_hardcoded(self):
        """get_max_theoretical_score should query DB, not use hardcoded value."""
        # Create two sets of rules with different weights
        RiskRuleFactory(code="rule1", is_hard_flag=False, weight=10)
        RiskRuleFactory(code="rule2", is_hard_flag=False, weight=5)
        # Hard flag should not be included in max score
        RiskRuleFactory(code="hard1", is_hard_flag=True, weight=999)

        engine = RiskEngine()
        max_score = engine.get_max_theoretical_score()

        # Max score should be sum of non-hard-flag weights = 10 + 5 = 15
        assert max_score == 15, "Max score should sum active non-hard-flag rules"

    def test_max_theoretical_score_never_zero(self):
        """get_max_theoretical_score should never return 0 (prevents division by zero)."""
        # Delete all non-hard-flag rules
        RiskRule.objects.filter(is_hard_flag=False).delete()

        engine = RiskEngine()
        max_score = engine.get_max_theoretical_score()

        assert max_score >= 1, "Max score should be at least 1 to prevent division by zero"

    def test_normalized_score_never_exceeds_100(self):
        """Normalized score should never exceed 100."""
        patient = PatientFactory()

        # Create many high-weight rules to test normalization
        for i in range(5):
            RiskRuleFactory(
                code=f"rule_{i}",
                field_path="patient.age_years",
                operator=RiskRule.Operator.GTE,
                value={"value": 0},
                is_hard_flag=False,
                weight=50,
            )

        survey = SurveyResponseFactory()

        engine = RiskEngine()
        result = engine.evaluate(patient, survey)

        assert result.normalized_score <= 100, "Normalized score must not exceed 100"

    def test_normalized_score_is_integer_0_to_100(self):
        """Normalized score should be an integer between 0 and 100."""
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"fever": True})

        RiskRuleFactory(
            code="fever_rule",
            field_path="survey.answers.fever",
            operator=RiskRule.Operator.TRUTHY,
            value={},
            is_hard_flag=False,
            weight=3,
        )

        engine = RiskEngine()
        result = engine.evaluate(patient, survey)

        assert isinstance(result.normalized_score, int), "Normalized score must be an integer"
        assert 0 <= result.normalized_score <= 100, "Normalized score must be between 0 and 100"

    def test_normalized_score_scales_with_max_theoretical_score(self):
        """Normalized score should scale correctly with max theoretical score."""
        patient = PatientFactory()

        # Create rules with total weight 100
        for i in range(10):
            RiskRuleFactory(
                code=f"rule_{i}",
                field_path="patient.age_years",
                operator=RiskRule.Operator.GTE,
                value={"value": 0},
                is_hard_flag=False,
                weight=10,
            )

        survey = SurveyResponseFactory()

        engine = RiskEngine()
        result = engine.evaluate(patient, survey)

        max_score = engine.get_max_theoretical_score()
        expected_normalized = min(round((result.total_score / max_score) * 100), 100)

        assert result.normalized_score == expected_normalized, "Normalized score calculation incorrect"

    def test_zero_score_normalizes_to_zero(self):
        """Zero total score should normalize to 0."""
        patient = PatientFactory()
        survey = SurveyResponseFactory()  # No matching symptoms

        RiskRuleFactory(
            code="fever_rule",
            field_path="survey.answers.fever",
            operator=RiskRule.Operator.TRUTHY,
            value={},
            is_hard_flag=False,
            weight=10,
        )

        engine = RiskEngine()
        result = engine.evaluate(patient, survey)

        assert result.total_score == 0
        assert result.normalized_score == 0


# ── CHECK 4: Rules Snapshot Immutability ──────────────────────────────────


@pytest.mark.django_db
class TestRulesSnapshotImmutability:
    """Verify rules snapshot is captured before evaluation and stored immutably."""

    def test_snapshot_captured_before_evaluation(self):
        """Rules snapshot should be captured before evaluation starts."""
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"fever": True})

        rule1 = RiskRuleFactory(code="rule1", is_hard_flag=False, weight=5)
        rule2 = RiskRuleFactory(code="rule2", is_hard_flag=False, weight=10)

        engine = RiskEngine()
        result = engine.evaluate(patient, survey)

        # Snapshot should contain both rules
        assert len(result.rules_snapshot) >= 2
        snapshot_codes = [r["code"] for r in result.rules_snapshot]
        assert rule1.code in snapshot_codes
        assert rule2.code in snapshot_codes

    def test_snapshot_persisted_to_database(self):
        """Rules snapshot should be persisted to database in RiskAssessment."""
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"fever": True})

        RiskRuleFactory(
            code="fever_rule",
            field_path="survey.answers.fever",
            operator=RiskRule.Operator.TRUTHY,
            value={},
            is_hard_flag=False,
            weight=5,
        )

        engine = RiskEngine()
        assessment = engine.create_assessment(patient, survey)

        # Fetch from database
        db_assessment = RiskAssessment.objects.get(pk=assessment.pk)
        assert db_assessment.rules_snapshot is not None
        assert len(db_assessment.rules_snapshot) > 0
        assert isinstance(db_assessment.rules_snapshot, list)

    def test_snapshot_includes_all_rule_metadata(self):
        """Snapshot should include all necessary rule metadata."""
        patient = PatientFactory()
        survey = SurveyResponseFactory()

        rule = RiskRuleFactory(
            code="test_rule",
            field_path="patient.age_years",
            operator=RiskRule.Operator.GTE,
            value={"value": 18},
            is_hard_flag=False,
            weight=7,
            category=RiskRule.Category.CHRONIC,
            rule_label_en="Age >= 18",
            rule_label_hi="आयु >= 18",
        )

        engine = RiskEngine()
        result = engine.evaluate(patient, survey)

        snapshot_entry = next((r for r in result.rules_snapshot if r["code"] == rule.code), None)
        assert snapshot_entry is not None
        assert snapshot_entry["id"] == rule.id
        assert snapshot_entry["field_path"] == rule.field_path
        assert snapshot_entry["operator"] == rule.operator
        assert snapshot_entry["weight"] == rule.weight
        assert snapshot_entry["category"] == rule.category
        assert snapshot_entry["is_hard_flag"] is False
        assert snapshot_entry["rule_label_en"] == rule.rule_label_en
        assert snapshot_entry["rule_label_hi"] == rule.rule_label_hi

    def test_snapshot_immutable_after_creation(self):
        """Rules snapshot should not be mutated after assessment creation."""
        patient = PatientFactory()
        survey = SurveyResponseFactory()

        RiskRuleFactory(code="rule1", is_hard_flag=False, weight=5)

        engine = RiskEngine()
        result1 = engine.evaluate(patient, survey)
        snapshot1 = result1.rules_snapshot.copy()

        # Create another assessment with same patient/survey
        result2 = engine.evaluate(patient, survey)
        snapshot2 = result2.rules_snapshot

        # Snapshots should be identical
        assert len(snapshot1) == len(snapshot2)
        for s1, s2 in zip(snapshot1, snapshot2):
            assert s1["code"] == s2["code"]
            assert s1["weight"] == s2["weight"]


# ── CHECK 5: Celery Task Retry Logic ──────────────────────────────────────


@pytest.mark.django_db
class TestCeleryTaskConfiguration:
    """Verify Celery tasks have correct retry configuration."""

    def test_run_risk_assessment_has_retry_config(self):
        """run_risk_assessment task should have max_retries=3, default_retry_delay=30."""
        from risk_engine.tasks import run_risk_assessment

        assert hasattr(run_risk_assessment, "max_retries")
        assert run_risk_assessment.max_retries == 3
        assert hasattr(run_risk_assessment, "default_retry_delay")
        assert run_risk_assessment.default_retry_delay == 30

    def test_enhance_with_gemma4_has_retry_config(self):
        """enhance_with_gemma4 task should have max_retries=3, default_retry_delay=30."""
        from risk_engine.tasks import enhance_with_gemma4

        assert hasattr(enhance_with_gemma4, "max_retries")
        assert enhance_with_gemma4.max_retries == 3
        assert hasattr(enhance_with_gemma4, "default_retry_delay")
        assert enhance_with_gemma4.default_retry_delay == 30

    def test_run_mcp_risk_assessment_has_retry_config(self):
        """run_mcp_risk_assessment task should have max_retries=3, default_retry_delay=30."""
        from risk_engine.tasks import run_mcp_risk_assessment

        assert hasattr(run_mcp_risk_assessment, "max_retries")
        assert run_mcp_risk_assessment.max_retries == 3
        assert hasattr(run_mcp_risk_assessment, "default_retry_delay")
        assert run_mcp_risk_assessment.default_retry_delay == 30

    def test_run_risk_assessment_task_graceful_patient_missing(self):
        """Task should handle missing patient gracefully."""
        from risk_engine.tasks import run_risk_assessment

        # Call with non-existent patient ID
        result = run_risk_assessment(999999)

        assert result["status"] == "skipped"
        assert "not_found" in result["reason"]

    def test_run_risk_assessment_success_path(self):
        """Task should complete successfully with valid inputs."""
        from risk_engine.tasks import run_risk_assessment

        patient = PatientFactory()
        survey = SurveyResponseFactory()

        result = run_risk_assessment(patient.id, survey.id)

        assert result["status"] == "completed"
        assert "assessment_id" in result
        assert "risk_level" in result
        assert "normalized_score" in result

    def test_run_risk_assessment_with_uuid_patient_id(self):
        """Task should handle patient UUID as patient_id."""
        from risk_engine.tasks import run_risk_assessment

        patient = PatientFactory()
        survey = SurveyResponseFactory()

        # Pass UUID as string
        result = run_risk_assessment(str(patient.local_uuid), str(survey.local_uuid))

        assert result["status"] == "completed"
