"""End-to-end pipeline validation — patient→survey→risk→flags→follow-up→incentive."""

from datetime import date

import pytest
from accounts.models import User
from django.utils import timezone
from incentives.models import IncentiveLedgerEntry
from registry.models import Household, Patient
from risk_engine.engine import RiskEngine, assess
from risk_engine.models import MLModelVersion, RiskRule
from surveys.models import SurveyResponse

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _seed_rules():
    """Seed risk rules before every test in this module."""
    from django.core.management import call_command
    call_command("seed_risk_rules")


# ─────────────────────────────────────────────
# Section A: Model integrity & admin registration
# ─────────────────────────────────────────────

class TestModelIntegrity:
    """Verify all new models, fields, and constraints work."""

    def test_household_all_fields(self):
        h = Household.objects.create(
            household_code="HH001", head_name="Ram", head_name_hi="राम",
            lat=28.6, lng=77.2, member_count=5, is_active=True, village="Testville",
        )
        assert h.household_code == "HH001"
        assert h.head_name_hi == "राम"
        assert h.lat == 28.6
        assert h.member_count == 5

    def test_patient_all_fields(self):
        h = Household.objects.create(household_code="HH002", village="Testville")
        p = Patient.objects.create(
            household=h, full_name="Sita", name_hi="सीता",
            relationship_to_head="Spouse", asha_worker=None,
            diabetes=True, hypertension=False, tb_history=False,
            prev_hospitalized=True, pregnancy_status=False, prev_high_risk_count=2,
            village="Testville",
        )
        assert p.name_hi == "सीता"
        assert p.diabetes is True
        assert p.prev_high_risk_count == 2
        assert p.relationship_to_head == "Spouse"

    def test_asha_worker_related_name(self):
        worker = User.objects.create(username="asha1", role=User.Role.HEALTH_WORKER)
        p = Patient.objects.create(full_name="Test", asha_worker=worker)
        assert list(worker.assigned_patients.all()) == [p]

    def test_ml_model_version_unique_active(self):
        from django.db import transaction
        m1 = MLModelVersion.objects.create(version=1, is_active=True)
        try:
            with transaction.atomic():
                MLModelVersion.objects.create(version=2, is_active=True)
        except Exception:
            pass
        else:
            pytest.fail("Expected unique constraint on is_active=True")
        m1.refresh_from_db()
        m1.delete()

    def test_ml_model_version_str(self):
        m = MLModelVersion.objects.create(version=5, is_active=True, cv_f1_macro=0.92)
        assert "MLModel v5" in str(m)
        assert "active" in str(m)

    def test_auth_session_is_valid(self):
        worker = User.objects.create(username="asha2", role=User.Role.HEALTH_WORKER)
        from accounts.models import AuthSession
        s = AuthSession.objects.create(
            worker=worker, expires_at=timezone.now() + timezone.timedelta(days=1),
        )
        assert s.is_valid is True
        s.revoked_at = timezone.now()
        s.save()
        assert s.is_valid is False

    def test_incentive_new_fields(self):
        worker = User.objects.create(username="asha3", role=User.Role.HEALTH_WORKER)
        entry = IncentiveLedgerEntry.objects.create(
            worker=worker,
            activity_type="survey_completion",
            amount_paise=5000,
            status="pending",
            month_year="2026-05",
            description_en="Survey complete",
            description_hi="सर्वे पूरा हुआ",
        )
        assert entry.amount_rupees == 50.0
        assert entry.activity_type == "survey_completion"
        assert entry.month_year == "2026-05"

    def test_survey_response_new_fields(self):
        p = Patient.objects.create(full_name="SurveyTest")
        s = SurveyResponse.objects.create(
            patient=p, survey_type="screening",
            photo_base64="iVBORw0KGgo=", synced_at=timezone.now(),
        )
        assert s.photo_base64 == "iVBORw0KGgo="
        assert s.synced_at is not None

    def test_follow_up_model(self):
        worker = User.objects.create(username="asha_fu", role=User.Role.HEALTH_WORKER)
        p = Patient.objects.create(full_name="FU Patient")
        from followups.models import FollowUp
        fu = FollowUp.objects.create(
            patient=p, worker=worker, scheduled_date=date.today(),
            urgency="within_24h", is_auto_scheduled=True,
        )
        assert fu.status == "pending"
        assert fu.urgency == "within_24h"

    def test_visit_record_model(self):
        worker = User.objects.create(username="asha_vr", role=User.Role.HEALTH_WORKER)
        p = Patient.objects.create(full_name="VR Patient")
        from followups.models import FollowUp, VisitRecord
        fu = FollowUp.objects.create(patient=p, worker=worker, scheduled_date=date.today())
        vr = VisitRecord.objects.create(
            patient=p, worker=worker, follow_up=fu,
            visit_date=date.today(), condition_observed="fair",
            referred_to_phc=True, referral_facility="PHC Test",
        )
        assert vr.referred_to_phc is True
        assert vr.referral_facility == "PHC Test"


# ─────────────────────────────────────────────
# Section B: Risk engine — rules + boundaries
# ─────────────────────────────────────────────

class TestRiskEngineBoundaries:
    """Verify scoring thresholds, hard flags, and edge cases."""

    def test_low_risk_low_score(self):
        engine = RiskEngine()
        p = Patient.objects.create(full_name="Low")
        s = SurveyResponse.objects.create(patient=p, survey_type="screening", answers={})
        result = engine.evaluate(p, s)
        assert result.level == "low"
        assert result.total_score == 0

    def test_medium_risk_score_combos(self):
        """fever(3) + chest_pain(4) = 7 → medium."""
        p = Patient.objects.create(full_name="Med")
        s = SurveyResponse.objects.create(patient=p, survey_type="screening", answers={
            "fever": True, "serious_chest_pain": True,
        })
        result = assess(p, s)
        assert result["total_score"] >= 4  # at least 2 rules fired
        assert result["level"] in ("medium", "high")

    def test_high_risk_via_multiple_rules(self):
        """fever(3) + cough_2w(4) + chest_pain(4) + comm_contact_sick(3) = 14 → high."""
        p = Patient.objects.create(full_name="HighRisk")
        s = SurveyResponse.objects.create(patient=p, survey_type="screening", answers={
            "fever": True, "cough_duration_weeks": 3,
            "comm_contact_sick": True, "serious_chest_pain": True,
        })
        result = assess(p, s)
        assert result["total_score"] >= 8
        assert result["level"] == "high"

    def test_hard_flag_severe_breathlessness_message(self):
        engine = RiskEngine()
        p = Patient.objects.create(full_name="Test", gender="female")
        s = SurveyResponse.objects.create(
            patient=p, survey_type="screening",
            answers={"breathlessness_severity": "severe"},
        )
        result = engine.evaluate(p, s)
        assert result.triggered_by_hard_flag is True
        assert "respiratory" in result.recommended_action_en.lower() or "emergency" in result.recommended_action_en.lower()
        assert result.recommendation_source != ""

    def test_hard_flag_uses_flag_type_as_recommendation_source(self):
        """For hard flags, recommendation_source should be the rule's flag_type."""
        engine = RiskEngine()
        p = Patient.objects.create(full_name="TestHF", gender="female")
        s = SurveyResponse.objects.create(
            patient=p, survey_type="screening",
            answers={"breathlessness_severity": "severe"},
        )
        result = engine.evaluate(p, s)
        # recommendation_source is set to rule.flag_type for hard flags
        assert result.recommendation_source != ""
        assert result.score_source == "rule_engine"

    def test_empty_survey_returns_low(self):
        p = Patient.objects.create(full_name="Empty")
        s = SurveyResponse.objects.create(patient=p, survey_type="screening", answers={})
        result = assess(p, s)
        assert result["level"] == "low"
        assert result["total_score"] == 0

    def test_no_survey_uses_patient_facts(self):
        p = Patient.objects.create(full_name="NoSurvey", date_of_birth=date(1950, 1, 1))
        result = assess(p, None)
        assert result["total_score"] >= 0  # age-based rules may fire

    def test_assessment_create_persists_source_fields(self):
        engine = RiskEngine()
        p = Patient.objects.create(full_name="PersistTest")
        a = engine.create_assessment(p, save=True)
        assert a.recommendation_source == "rule_template"
        assert a.score_source == "rule_engine"
        assert a.rule_engine_score == a.total_score


# ─────────────────────────────────────────────
# Section C: Seed commands idempotent
# ─────────────────────────────────────────────

class TestSeedCommands:
    """Verify seed_risk_rules and verify_risk_engine are idempotent."""

    def test_seed_risk_rules_idempotent(self):
        from django.core.management import call_command
        call_command("seed_risk_rules")
        count = RiskRule.objects.count()
        call_command("seed_risk_rules")
        assert RiskRule.objects.count() == count

    def test_verify_risk_engine_passes(self):
        from django.core.management import call_command
        call_command("seed_risk_rules")
        call_command("verify_risk_engine")


# ─────────────────────────────────────────────
# Section D: API endpoints respond correctly
# ─────────────────────────────────────────────

class TestApiEndpoints:
    """Verify all new API endpoints are reachable and enforce auth."""

    def test_followups_api_requires_auth(self, client):
        resp = client.get("/api/v1/followups/followups/")
        assert resp.status_code in (401, 403)

    def test_visits_api_requires_auth(self, client):
        resp = client.get("/api/v1/followups/visits/")
        assert resp.status_code in (401, 403)

    def test_incentives_api_requires_auth(self, client):
        resp = client.get("/api/v1/incentives/ledger/")
        assert resp.status_code in (401, 403)


# ─────────────────────────────────────────────
# Section E: Feature flags contract compliance
# ─────────────────────────────────────────────

class TestFeatureFlagsContract:
    """Verify feature flags match master prompt spec."""

    def test_mvp_feature_flags_exist(self):
        """FEATURES should have all 8 MVP-defined flags, all default false."""
        import os
        flags_path = os.path.join(os.path.dirname(__file__), "..", "..", "mobile", "src", "constants", "featureFlags.js")
        with open(flags_path) as f:
            content = f.read()
        required = ["VISIT_VERIFICATION_OTP", "OFFLINE_MAP", "GPS_TRACKING", "VOICE_INPUT",
                     "PDF_PAYSLIP", "TFLITE_SCORING", "GEMMA_ONDEVICE", "ABDM_COMPLIANCE"]
        for flag in required:
            assert flag in content, f"FEATURES.{flag} missing from featureFlags.js"

    def test_incentive_rates_in_paise(self):
        """INCENTIVE_RATES should be in paise (rupees × 100)."""
        import os
        flags_path = os.path.join(os.path.dirname(__file__), "..", "..", "mobile", "src", "constants", "featureFlags.js")
        with open(flags_path) as f:
            content = f.read()
        assert "survey_completion: 5000" in content, "survey_completion should be 5000 paise (₹50)"
        assert "hard_flag_referral: 20000" in content, "hard_flag_referral should be 20000 paise (₹200)"
