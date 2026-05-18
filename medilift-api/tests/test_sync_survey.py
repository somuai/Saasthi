import time

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.patients.models import Flag, Patient, SurveyResponse
from apps.flagging.engine import FlaggingEngine


class SyncSurveyTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="919911110000", password="x")
        refresh = RefreshToken.for_user(self.user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        self.worker_id = str(self.user.id)
        ts = int(time.time() * 1000)
        Patient.objects.create(
            id="p-survey-1",
            patient_code="SUR-1",
            name="Survey Patient",
            asha_worker_server_id=self.worker_id,
            is_synced=True,
            created_at=ts,
            updated_at=ts,
            is_deleted=False,
            is_mock=False,
        )

    def test_push_survey_payload_json(self):
        ts = int(time.time() * 1000)
        payload = {
            "changes": {
                "survey_responses": {
                    "created": [
                        {
                            "id": "srv-1",
                            "patient_id": "p-survey-1",
                            "survey_date": "2026-05-18",
                            "comm_cough_2weeks": True,
                            "serious_severe_breathing": False,
                            "is_synced": False,
                            "created_at": ts,
                            "updated_at": ts,
                            "is_deleted": False,
                            "is_mock": False,
                        }
                    ],
                    "updated": [],
                    "deleted": [],
                }
            }
        }
        res = self.client.post("/api/v1/sync/push/", payload, format="json")
        self.assertEqual(res.status_code, 200)
        srv = SurveyResponse.objects.get(id="srv-1")
        self.assertTrue(srv.payload_json.get("comm_cough_2weeks"))
        Flag.objects.filter(patient_id="p-survey-1", flag_type="TB_RISK").delete()
        FlaggingEngine().flag_tb_risk()
        self.assertTrue(Flag.objects.filter(patient_id="p-survey-1", flag_type="TB_RISK").exists())

    def test_push_patient_other_worker_denied(self):
        other = User.objects.create_user(username="919911110001", password="x")
        ts = int(time.time() * 1000)
        payload = {
            "changes": {
                "patients": {
                    "created": [
                        {
                            "id": "p-other",
                            "patient_code": "OTHER",
                            "name": "Other",
                            "asha_worker_server_id": str(other.id),
                            "is_synced": False,
                            "created_at": ts,
                            "updated_at": ts,
                            "is_deleted": False,
                            "is_mock": False,
                        }
                    ],
                    "updated": [],
                    "deleted": [],
                }
            }
        }
        res = self.client.post("/api/v1/sync/push/", payload, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data.get("errors"))
