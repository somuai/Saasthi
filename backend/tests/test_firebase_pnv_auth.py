import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from tests.factories import SupervisorFactory, WorkerRegistrationFactory

FIREBASE_PNV_VERIFY_URL = "/api/v1/auth/firebase/pnv/verify/"


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def active_worker_registration(db):
    supervisor = SupervisorFactory.create()
    return WorkerRegistrationFactory.create(
        phone="+919876543210",
        is_active=True,
        supervisor=supervisor,
    )


@pytest.mark.django_db
def test_pnv_disabled_returns_503(api_client):
    response = api_client.post(
        FIREBASE_PNV_VERIFY_URL,
        {"pnv_token": "any-token", "phone": "+919876543210"},
        format="json",
    )
    assert response.status_code == 503
    assert "not enabled" in response.data["detail"].lower()


@pytest.mark.django_db
@override_settings(FIREBASE_PNV_ENABLED=True, FIREBASE_PNV_ACCEPT_TEST_TOKENS=True, DEBUG=True)
def test_pnv_test_token_login_returns_tokens(api_client, active_worker_registration):
    response = api_client.post(
        FIREBASE_PNV_VERIFY_URL,
        {"pnv_token": "test:+919876543210", "phone": "+919876543210"},
        format="json",
    )
    assert response.status_code == 200
    assert "access" in response.data
    assert "refresh" in response.data
    assert response.data["user"]["phone"] == "+919876543210"


@pytest.mark.django_db
@override_settings(FIREBASE_PNV_ENABLED=True, FIREBASE_PNV_ACCEPT_TEST_TOKENS=True, DEBUG=True)
def test_pnv_test_token_phone_mismatch_rejected(api_client, active_worker_registration):
    response = api_client.post(
        FIREBASE_PNV_VERIFY_URL,
        {"pnv_token": "test:+919876543210", "phone": "+919111111111"},
        format="json",
    )
    assert response.status_code in (401, 403)
