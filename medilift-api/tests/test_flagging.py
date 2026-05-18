from django.test import TestCase

from apps.flagging.engine import FlaggingEngine
from apps.patients.models import Flag, FollowUp, Patient, SurveyResponse
from apps.sync_api.registry import now_ms


class FlaggingEngineTests(TestCase):
    def setUp(self):
        ts = now_ms()
        self.patient = Patient.objects.create(
            id="pt-flag-1",
            patient_code="P-FLAG-1",
            name="Test",
            risk_level="high",
            risk_score=60,
            is_synced=True,
            created_at=ts,
            updated_at=ts,
            is_deleted=False,
            is_mock=True,
        )

    def test_high_risk_creates_flag(self):
        result = FlaggingEngine().flag_high_risk_patients()
        self.assertGreaterEqual(result["created"], 1)
        self.assertTrue(
            Flag.objects.filter(patient_id=self.patient.id, flag_type="HIGH_RISK").exists()
        )

    def test_tb_payload_creates_flag(self):
        ts = now_ms()
        SurveyResponse.objects.create(
            id="srv-tb-1",
            patient_id=self.patient.id,
            payload_json={"comm_cough_2weeks": True},
            is_synced=True,
            created_at=ts,
            updated_at=ts,
            is_deleted=False,
            is_mock=True,
        )
        result = FlaggingEngine().flag_tb_risk()
        self.assertGreaterEqual(result["created"], 1)

    def test_severe_anemia_from_vitals(self):
        ts = now_ms()
        SurveyResponse.objects.create(
            id="srv-anemia-1",
            patient_id=self.patient.id,
            payload_json={"vitals": {"hemoglobin": "6.5"}},
            is_synced=True,
            created_at=ts,
            updated_at=ts,
            is_deleted=False,
            is_mock=True,
        )
        result = FlaggingEngine().flag_severe_anemia()
        self.assertGreaterEqual(result["created"], 1)
        self.assertTrue(
            Flag.objects.filter(patient_id=self.patient.id, flag_type="SEVERE_ANEMIA").exists()
        )

    def test_missed_followup_creates_flag(self):
        ts = now_ms()
        FollowUp.objects.create(
            id="fu-1",
            patient_id=self.patient.id,
            due_date="2020-01-01",
            is_completed=False,
            is_synced=True,
            created_at=ts,
            updated_at=ts,
            is_deleted=False,
            is_mock=True,
        )
        result = FlaggingEngine().flag_missed_followup()
        self.assertGreaterEqual(result["created"], 1)

    def test_run_all_rules_returns_nine_keys(self):
        results = FlaggingEngine().run_all_rules()
        self.assertEqual(len(results), 9)
