import time

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from apps.patients.models import Patient


class WorkerScopeTests(TestCase):
    def setUp(self):
        self.user_a = User.objects.create_user(username="919900000001", password="x")
        self.user_b = User.objects.create_user(username="919900000002", password="x")
        self.client_a = APIClient()
        self.client_b = APIClient()
        self.client_a.credentials(
            HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(self.user_a).access_token}"
        )
        self.client_b.credentials(
            HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(self.user_b).access_token}"
        )
        ts = int(time.time() * 1000)
        Patient.objects.create(
            id="scope-p-b",
            patient_code="B-1",
            name="B Patient",
            asha_worker_server_id=str(self.user_b.id),
            is_synced=True,
            created_at=ts,
            updated_at=ts,
            is_deleted=False,
            is_mock=False,
        )

    def test_worker_a_cannot_see_b_patients(self):
        res = self.client_a.get("/api/v1/sync/pull/", {"last_pulled_at": 0})
        self.assertEqual(res.status_code, 200)
        ids = {r["id"] for r in res.data["changes"]["patients"]["created"]}
        ids.update(r["id"] for r in res.data["changes"]["patients"]["updated"])
        self.assertNotIn("scope-p-b", ids)
