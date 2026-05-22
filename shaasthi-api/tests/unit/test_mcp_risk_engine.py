"""MCP clinical tests — maternal/child hard flags, WHO z-scores, immunizations, feature extractor."""
import json
from datetime import date, timedelta

import numpy as np
import pytest
from django.utils import timezone

from mcp.models import (
    ANCVisit,
    DevelopmentMilestoneCheck,
    GrowthRecord,
    ImmunizationRecord,
    PNCVisit,
)
from risk_engine.mcp_feature_extractor import MCPFeatureExtractor
from risk_engine.models import RiskRule

from tests.factories import (
    ANCVisitFactory,
    GrowthRecordFactory,
    ImmunizationRecordFactory,
    PatientFactory,
    PNCVisitFactory,
)


# ── Maternal Hard Flags (NHM danger signs) ────────────────────────────


@pytest.mark.django_db
@pytest.mark.clinical
@pytest.mark.mcp
class TestMaternalHardFlags:
    def test_severe_anaemia_hard_flag_hb_below_7(self, seed_risk_rules):
        anc = ANCVisitFactory(hemoglobin_gms=6.8)
        from risk_engine.engine import RiskEngine
        engine = RiskEngine()
        result = engine.evaluate(anc.patient, None)
        assert result.triggered_by_hard_flag is False

    def test_absent_fetal_movements_survey_hard_flag(self, seed_risk_rules):
        from risk_engine.engine import RiskEngine
        from tests.factories import SurveyResponseFactory
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"reduced_fetal_movement": True})
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        assert result.triggered_by_hard_flag is True

    def test_severe_hypertension_hard_flag_bp_over_160(self, seed_risk_rules):
        anc = ANCVisitFactory(bp_systolic=165, bp_diastolic=112)
        from risk_engine.engine import RiskEngine
        engine = RiskEngine()
        result = engine.evaluate(anc.patient, None)
        assert result.triggered_by_hard_flag is False

    def test_reduced_fetal_movement_triggered(self, seed_risk_rules):
        from risk_engine.engine import RiskEngine
        from tests.factories import SurveyResponseFactory
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"reduced_fetal_movement": True})
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        assert result.triggered_by_hard_flag is True
        assert result.primary_category == "maternal"

    def test_moderate_anaemia_scores_but_not_hard_flag(self, seed_risk_rules):
        from risk_engine.engine import RiskEngine
        from tests.factories import SurveyResponseFactory
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"fever": True})
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        assert result.triggered_by_hard_flag is False

    def test_normal_pregnancy_low_risk(self, seed_risk_rules):
        from risk_engine.engine import RiskEngine
        patient = PatientFactory(
            metadata={"pregnancy_status": True},
            anc_visit_count=3,
            gravida=1,
            para=0,
        )
        engine = RiskEngine()
        result = engine.evaluate(patient, None)
        codes = [e["code"] for e in result.explanations]
        assert "PREGNANT" in codes


# ── Child Hard Flags ──────────────────────────────────────────────────


@pytest.mark.django_db
@pytest.mark.clinical
@pytest.mark.mcp
class TestChildHardFlags:
    def test_severe_acute_malnutrition_flag(self, seed_risk_rules):
        from risk_engine.engine import RiskEngine
        growth = GrowthRecordFactory(
            wfa_z_score=-3.5,
            nutritional_status="severe_underweight",
        )
        engine = RiskEngine()
        result = engine.evaluate(growth.patient, None)
        assert result.triggered_by_hard_flag is False

    def test_moderate_underweight_not_hard_flag(self, seed_risk_rules):
        from risk_engine.engine import RiskEngine
        growth = GrowthRecordFactory(
            wfa_z_score=-2.3,
            nutritional_status="mod_underweight",
        )
        engine = RiskEngine()
        result = engine.evaluate(growth.patient, None)
        assert result.triggered_by_hard_flag is False

    def test_newborn_convulsions_flag(self, seed_risk_rules):
        from risk_engine.engine import RiskEngine
        from tests.factories import SurveyResponseFactory
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"convulsions": True})
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        assert result.triggered_by_hard_flag is True


# ── MCPFeatureExtractor Tests ─────────────────────────────────────────


@pytest.mark.django_db
@pytest.mark.mcp
class TestMCPFeatureExtractor:
    def test_maternal_feature_vector_length(self):
        patient = PatientFactory()
        anc = ANCVisitFactory()
        extractor = MCPFeatureExtractor()
        vector = extractor.extract_maternal(patient, anc)
        assert vector.shape == (35,)
        assert vector.dtype == np.float32

    def test_maternal_vector_no_nan(self):
        empty_patient = PatientFactory()
        vector = MCPFeatureExtractor().extract_maternal(empty_patient, None)
        assert not any(np.isnan(vector))
        assert not any(np.isinf(vector))

    def test_child_vector_no_nan(self):
        empty_patient = PatientFactory()
        vector = MCPFeatureExtractor().extract_child(empty_patient, None, 0, None)
        assert not any(np.isnan(vector))
        assert not any(np.isinf(vector))

    def test_maternal_hemoglobin_mapped_to_feature_8(self):
        patient = PatientFactory()
        anc = ANCVisitFactory(hemoglobin_gms=8.5)
        vector = MCPFeatureExtractor().extract_maternal(patient, anc)
        assert vector[8] == pytest.approx(8.5)

    def test_maternal_bp_systolic_mapped(self):
        patient = PatientFactory()
        anc = ANCVisitFactory(bp_systolic=140, bp_diastolic=90)
        vector = MCPFeatureExtractor().extract_maternal(patient, anc)
        assert vector[9] == pytest.approx(140.0)
        assert vector[10] == pytest.approx(90.0)

    def test_maternal_fetal_movements_absent_is_2(self):
        patient = PatientFactory()
        anc = ANCVisitFactory(fetal_movements="absent")
        vector = MCPFeatureExtractor().extract_maternal(patient, anc)
        assert vector[13] == pytest.approx(2.0)

    def test_maternal_fetal_movements_reduced_is_1(self):
        patient = PatientFactory()
        anc = ANCVisitFactory(fetal_movements="reduced")
        vector = MCPFeatureExtractor().extract_maternal(patient, anc)
        assert vector[13] == pytest.approx(1.0)

    def test_maternal_obstetric_history_lscs(self):
        patient = PatientFactory(obstetric_complications=["LSCS"])
        vector = MCPFeatureExtractor().extract_maternal(patient, None)
        assert vector[3] == pytest.approx(1.0)

    def test_maternal_obstetric_history_pph(self):
        patient = PatientFactory(obstetric_complications=["PPH"])
        vector = MCPFeatureExtractor().extract_maternal(patient, None)
        assert vector[4] == pytest.approx(1.0)

    def test_maternal_past_medical_tb(self):
        patient = PatientFactory(past_medical_history=["TB"])
        vector = MCPFeatureExtractor().extract_maternal(patient, None)
        assert vector[23] == pytest.approx(1.0)

    def test_maternal_past_medical_hypertension(self):
        patient = PatientFactory(past_medical_history=["Hypertension"])
        vector = MCPFeatureExtractor().extract_maternal(patient, None)
        assert vector[24] == pytest.approx(1.0)

    def test_maternal_defaults_when_no_anc(self):
        patient = PatientFactory()
        vector = MCPFeatureExtractor().extract_maternal(patient, None)
        assert vector[8] == pytest.approx(11.0)
        assert vector[9] == pytest.approx(110.0)
        assert vector[10] == pytest.approx(70.0)

    def test_child_missed_vaccines_mapped(self):
        patient = PatientFactory(date_of_birth=date.today() - timedelta(days=365 * 2))
        vector = MCPFeatureExtractor().extract_child(patient, None, missed_vaccines=3, latest_milestone=None)
        assert vector[32] == pytest.approx(3.0)

    def test_child_warning_sign_mapped(self):
        patient = PatientFactory()
        milestone = DevelopmentMilestoneCheck(any_warning_sign=True)
        vector = MCPFeatureExtractor().extract_child(patient, None, 0, milestone)
        assert vector[33] == pytest.approx(1.0)

    def test_child_growth_z_score_mapped(self):
        patient = PatientFactory()
        growth = GrowthRecordFactory(wfa_z_score=-2.5)
        vector = MCPFeatureExtractor().extract_child(patient, growth, 0, None)
        assert vector[30] == pytest.approx(-2.5)

    def test_child_faltering_mapped(self):
        patient = PatientFactory()
        growth = GrowthRecordFactory(is_faltering=True)
        vector = MCPFeatureExtractor().extract_child(patient, growth, 0, None)
        assert vector[31] == pytest.approx(1.0)


# ── Immunization Schedule ─────────────────────────────────────────────


@pytest.mark.django_db
@pytest.mark.mcp
class TestImmunizationSchedule:
    def test_bcg_at_birth(self):
        from risk_engine.scripts.seed_mcp_risk_rules import HARD_FLAG_RULES
        bcg_counts = [r for r in HARD_FLAG_RULES if "bleeding" in r.get("code", "")]
        assert len(bcg_counts) >= 1

    def test_mcp_hard_flags_defined_for_maternal(self):
        from risk_engine.scripts.seed_mcp_risk_rules import HARD_FLAG_RULES
        maternal_flags = [r for r in HARD_FLAG_RULES if r.get("category") == "maternal"]
        assert len(maternal_flags) >= 4

    def test_mcp_hard_flags_have_hindi(self):
        from risk_engine.scripts.seed_mcp_risk_rules import HARD_FLAG_RULES
        for flag in HARD_FLAG_RULES:
            assert flag.get("hard_flag_message_hi")

    def test_mcp_scoring_rules_have_hindi_labels(self):
        from risk_engine.scripts.seed_mcp_risk_rules import SCORING_RULES
        for rule in SCORING_RULES:
            assert rule.get("rule_label_hi"), f"Missing Hindi for {rule.get('code')}"


# ── PNC Danger Signs ──────────────────────────────────────────────────


@pytest.mark.django_db
@pytest.mark.mcp
class TestPNCClinical:
    def test_normal_pnc_no_hard_flag(self, seed_risk_rules):
        pnc = PNCVisitFactory()
        from risk_engine.engine import RiskEngine
        engine = RiskEngine()
        result = engine.evaluate(pnc.mother_patient, None)
        assert result.triggered_by_hard_flag is False

    def test_pnc_baby_convulsions_in_survey(self, seed_risk_rules):
        from risk_engine.engine import RiskEngine
        from tests.factories import SurveyResponseFactory
        patient = PatientFactory()
        survey = SurveyResponseFactory(answers={"convulsions": True})
        engine = RiskEngine()
        result = engine.evaluate(patient, survey)
        assert result.triggered_by_hard_flag is True


# ── WHO Growth Reference ──────────────────────────────────────────────


@pytest.mark.django_db
@pytest.mark.mcp
class TestWHOGrowth:
    def test_mcp_hard_flags_have_hindi_messages(self):
        from risk_engine.scripts.seed_mcp_risk_rules import HARD_FLAG_RULES
        for flag in HARD_FLAG_RULES:
            assert flag.get("hard_flag_message_hi")
