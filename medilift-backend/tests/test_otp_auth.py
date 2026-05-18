import pytest
from django.test import override_settings

from accounts.models import OTPChallenge, User


@pytest.mark.django_db
@override_settings(EXPOSE_DEBUG_OTP=True)
def test_otp_request_and_verify_returns_tokens(api_client):
    phone = "+15551234567"
    request_response = api_client.post("/api/v1/auth/otp/request/", {"phone": phone}, format="json")

    assert request_response.status_code == 201
    assert "debug_otp" in request_response.data
    assert OTPChallenge.objects.filter(phone=phone).count() == 1

    verify_response = api_client.post(
        "/api/v1/auth/otp/verify/",
        {"phone": phone, "code": request_response.data["debug_otp"]},
        format="json",
    )

    assert verify_response.status_code == 200
    assert verify_response.data["user"]["phone"] == phone
    assert verify_response.data["user"]["role"] == User.Role.HEALTH_WORKER
    assert verify_response.data["access"]
    assert verify_response.data["refresh"]
    assert OTPChallenge.objects.get(phone=phone).consumed_at is not None
