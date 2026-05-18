import time

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.patients.models import Patient


class SyncApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="919999999999", password="x")
        refresh = RefreshToken.for_user(self.user)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {refresh.access_token}")
        ts = int(time.time() * 1000)
        Patient.objects.create(
            id="server-patient-1",
            patient_code="S-P-1",
            name="Server Patient",
            asha_worker_server_id=str(self.user.id),
            is_synced=True,
            created_at=ts,
            updated_at=ts,
            is_deleted=False,
            is_mock=False,
        )

    def test_pull_returns_changes_shape(self):
        res = self.client.get("/api/v1/sync/pull/", {"last_pulled_at": 0})
        self.assertEqual(res.status_code, 200)
        self.assertIn("changes", res.data)
        self.assertIn("patients", res.data["changes"])
        self.assertTrue(len(res.data["changes"]["patients"]["created"]) >= 1)

    def test_push_creates_patient(self):
        ts = int(time.time() * 1000)
        payload = {
            "changes": {
                "patients": {
                    "created": [
                        {
                            "id": "client-patient-99",
                            "patient_code": "C-P-99",
                            "name": "Client Patient",
                            "asha_worker_server_id": str(self.user.id),
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
        self.assertEqual(Patient.objects.filter(id="client-patient-99").count(), 1)
