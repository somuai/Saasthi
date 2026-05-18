from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import OTPRecord


class OTPTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_request_and_verify_otp(self):
        phone = "+919911112233"
        res = self.client.post("/api/v1/auth/otp/request/", {"phone": phone}, format="json")
        self.assertEqual(res.status_code, 200)
        otp = res.data.get("dev_otp")
        self.assertEqual(len(otp), 6)
        verify = self.client.post("/api/v1/auth/otp/verify/", {"phone": phone, "otp": otp}, format="json")
        self.assertEqual(verify.status_code, 200)
        self.assertIn("access", verify.data)

    def test_invalid_otp_rejected(self):
        phone = "+919911112244"
        self.client.post("/api/v1/auth/otp/request/", {"phone": phone}, format="json")
        bad = self.client.post("/api/v1/auth/otp/verify/", {"phone": phone, "otp": "999999"}, format="json")
        self.assertEqual(bad.status_code, 400)

    def test_expired_otp_rejected(self):
        phone = "+919911112255"
        OTPRecord.objects.create(
            phone=phone,
            otp="123456",
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        res = self.client.post("/api/v1/auth/otp/verify/", {"phone": phone, "otp": "123456"}, format="json")
        self.assertEqual(res.status_code, 400)
