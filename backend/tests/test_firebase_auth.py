from unittest.mock import patch

import pytest
from accounts.models import User
from django.utils import timezone
from firebase_admin import auth as firebase_auth
from rest_framework.test import APIClient

from tests.factories import SupervisorFactory, WorkerRegistrationFactory

FIREBASE_VERIFY_URL = '/api/v1/auth/firebase/verify/'


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def supervisor(db):
    return SupervisorFactory.create()


@pytest.fixture
def active_worker_registration(db, supervisor):
    return WorkerRegistrationFactory.create(
        phone='+919876543210',
        is_active=True,
        supervisor=supervisor,
    )


@pytest.fixture
def tendigit_worker_registration(db, supervisor):
    return WorkerRegistrationFactory.create(
        phone='9988776655',
        is_active=True,
        supervisor=supervisor,
    )


@pytest.fixture
def inactive_worker_registration(db, supervisor):
    return WorkerRegistrationFactory.create(
        phone='+919000000000',
        is_active=False,
        supervisor=supervisor,
    )


def make_mock_decoded_token(phone='+919876543210', uid='firebase_uid_123'):
    return {
        'uid': uid,
        'phone_number': phone,
        'iss': 'https://securetoken.google.com/test-project',
    }


@pytest.mark.django_db
class TestFirebaseVerifyEndpoint:

    def test_missing_token_returns_400(self, api_client):
        """Missing id_token must return 400."""
        response = api_client.post(FIREBASE_VERIFY_URL, {}, format='json')
        assert response.status_code == 400
        assert 'id_token' in response.data

    def test_invalid_token_returns_401(self, api_client):
        """Garbage token must return 401 (or 403 when no auth class provides challenge)."""
        with patch('firebase_admin.auth.verify_id_token',
                   side_effect=firebase_auth.InvalidIdTokenError('bad token', None)):
            response = api_client.post(
                FIREBASE_VERIFY_URL,
                {'id_token': 'garbage'},
                format='json'
            )
        assert response.status_code in (401, 403)
        assert 'invalid' in response.data['detail'].lower()

    def test_expired_token_returns_401(self, api_client):
        """Expired token must return 401 (or 403 when no auth class provides challenge)."""
        with patch('firebase_admin.auth.verify_id_token',
                   side_effect=firebase_auth.ExpiredIdTokenError('expired', None)):
            response = api_client.post(
                FIREBASE_VERIFY_URL,
                {'id_token': 'expired_token'},
                format='json'
            )
        assert response.status_code in (401, 403)
        assert 'expired' in response.data['detail'].lower()

    def test_revoked_token_returns_401(self, api_client):
        """Revoked token must return 401 (or 403 when no auth class provides challenge)."""
        with patch('firebase_admin.auth.verify_id_token',
                   side_effect=firebase_auth.RevokedIdTokenError('revoked')):
            response = api_client.post(
                FIREBASE_VERIFY_URL,
                {'id_token': 'revoked_token'},
                format='json'
            )
        assert response.status_code in (401, 403)
        assert 'revoked' in response.data['detail'].lower()

    def test_unregistered_phone_returns_404(self, api_client):
        """Phone not in DB must return 404 with ANM guidance message."""
        with patch('firebase_admin.auth.verify_id_token',
                   return_value=make_mock_decoded_token(phone='+919111111111')):
            response = api_client.post(
                FIREBASE_VERIFY_URL,
                {'id_token': 'valid_but_unknown_phone'},
                format='json'
            )
        assert response.status_code == 404
        assert 'ANM' in response.data['detail']

    def test_inactive_worker_returns_404(self, api_client, inactive_worker_registration):
        """Deactivated ASHA worker must not be able to log in (returns 404)."""
        with patch('firebase_admin.auth.verify_id_token',
                   return_value=make_mock_decoded_token(phone='+919000000000')):
            response = api_client.post(
                FIREBASE_VERIFY_URL,
                {'id_token': 'valid_token_inactive_worker'},
                format='json'
            )
        assert response.status_code == 404

    def test_successful_login_returns_tokens(self, api_client, active_worker_registration):
        """Valid Firebase token for registered worker returns SimpleJWT tokens."""
        with patch('firebase_admin.auth.verify_id_token',
                   return_value=make_mock_decoded_token(phone='+919876543210')):
            response = api_client.post(
                FIREBASE_VERIFY_URL,
                {'id_token': 'valid_token'},
                format='json'
            )
        assert response.status_code == 200
        assert 'access' in response.data
        assert 'refresh' in response.data
        assert 'user' in response.data

    def test_successful_login_returns_worker_profile(self, api_client, active_worker_registration):
        """Response must include worker phone, role, and local settings."""
        with patch('firebase_admin.auth.verify_id_token',
                   return_value=make_mock_decoded_token(phone='+919876543210')):
            response = api_client.post(
                FIREBASE_VERIFY_URL,
                {'id_token': 'valid_token'},
                format='json'
            )
        user_data = response.data['user']
        assert user_data['phone'] == '+919876543210'
        assert user_data['role'] == User.Role.HEALTH_WORKER
        assert 'village' in user_data
        assert 'block' in user_data

    def test_jwt_contains_role_claim(self, api_client, active_worker_registration):
        """SimpleJWT must encode claims for permission checks."""
        from rest_framework_simplejwt.tokens import AccessToken
        with patch('firebase_admin.auth.verify_id_token',
                   return_value=make_mock_decoded_token(phone='+919876543210')):
            response = api_client.post(
                FIREBASE_VERIFY_URL,
                {'id_token': 'valid_token'},
                format='json'
            )
        token = AccessToken(response.data['access'])
        assert token['role'] == User.Role.HEALTH_WORKER

    def test_phone_normalization_prefixed_to_10digit(self, api_client, tendigit_worker_registration):
        """Incoming +91 from Firebase must successfully match a 10-digit DB number."""
        # Worker is registered as '9988776655'
        # Firebase returns '+919988776655'
        # These must normalized-match and log in successfully
        with patch('firebase_admin.auth.verify_id_token',
                   return_value=make_mock_decoded_token(phone='+919988776655')):
            response = api_client.post(
                FIREBASE_VERIFY_URL,
                {'id_token': 'valid_token_prefixed'},
                format='json'
            )
        assert response.status_code == 200
        assert response.data['user']['phone'] == '+919988776655'

    def test_phone_normalization_10digit_to_prefixed(self, api_client, active_worker_registration):
        """Incoming 10-digit phone must match +91 database entry."""
        # Worker is registered as '+919876543210'
        # Firebase returns token with '9876543210'
        with patch('firebase_admin.auth.verify_id_token',
                   return_value=make_mock_decoded_token(phone='9876543210')):
            response = api_client.post(
                FIREBASE_VERIFY_URL,
                {'id_token': 'valid_token_10digit'},
                format='json'
            )
        assert response.status_code == 200

    def test_no_phone_in_token_returns_400(self, api_client):
        """Token without phone_number claim must be rejected with validation error."""
        with patch('firebase_admin.auth.verify_id_token',
                   return_value={'uid': 'uid123'}):
            response = api_client.post(
                FIREBASE_VERIFY_URL,
                {'id_token': 'valid_token_no_phone'},
                format='json'
            )
        assert response.status_code == 400
        detail = str(response.data.get("non_field_errors", [response.data.get("detail", "")])[0]).lower()
        assert 'phone number' in detail or 'no phone' in detail

    def test_firebase_service_unavailable_returns_503(self, api_client):
        """Firebase SDK API down or JWKs fetch timeouts must return 503 Service Unavailable."""
        with patch('firebase_admin.auth.verify_id_token',
                   side_effect=Exception('SSL handshaking timeout or network connection failed')):
            response = api_client.post(
                FIREBASE_VERIFY_URL,
                {'id_token': 'some_token'},
                format='json'
            )
        assert response.status_code == 503
        assert 'verification service' in response.data['detail'].lower()

    def test_last_login_updated_on_success(self, api_client, active_worker_registration):
        """User's last_login timestamp must be explicitly updated upon successful verify."""
        with patch('firebase_admin.auth.verify_id_token',
                   return_value=make_mock_decoded_token(phone='+919876543210')):
            response = api_client.post(
                FIREBASE_VERIFY_URL,
                {'id_token': 'valid_token'},
                format='json'
            )
        assert response.status_code == 200
        user = User.objects.get(phone='+919876543210')
        assert user.last_login is not None
        assert (timezone.now() - user.last_login).total_seconds() < 5
