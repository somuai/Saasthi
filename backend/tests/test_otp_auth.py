import pytest
from accounts.models import OTPChallenge, User, WorkerRegistration
from accounts.serializers import normalize_phone, normalize_phone_strict
from django.test import override_settings

# ─── Phone normalization ───


@pytest.mark.parametrize(
    "input_phone,expected_raw,expected_10",
    [
        ("+919876543210", "+919876543210", "9876543210"),
        ("+91 9876543210", "+919876543210", "9876543210"),
        ("919876543210", "+919876543210", "9876543210"),
        ("9876543210", "+919876543210", "9876543210"),
        ("+15551234567", "+15551234567", "15551234567"),
        ("+1 555 123 4567", "+15551234567", "15551234567"),
    ],
)
def test_normalize_phone(input_phone, expected_raw, expected_10):
    raw, ten = normalize_phone(input_phone)
    assert raw == expected_raw
    assert ten == expected_10
    assert normalize_phone_strict(input_phone) == expected_raw


# ─── OTP request + verify ───


@pytest.fixture
def registered_worker(db):
    sup = User.objects.create_user(username="sup", phone="+10000000000", role=User.Role.SUPERVISOR)
    WorkerRegistration.objects.create(
        phone="+919876543210",
        full_name="Test Worker",
        supervisor=sup,
        created_by=sup,
    )
    return "+919876543210"


@pytest.mark.django_db
@override_settings(EXPOSE_DEBUG_OTP=True)
def test_otp_request_and_verify_returns_tokens(api_client, registered_worker):
    resp = api_client.post("/api/v1/auth/otp/request/", {"phone": registered_worker}, format="json")

    assert resp.status_code == 201
    assert "debug_otp" in resp.data
    assert OTPChallenge.objects.filter(phone=registered_worker).count() == 1

    verify = api_client.post(
        "/api/v1/auth/otp/verify/",
        {"phone": registered_worker, "code": resp.data["debug_otp"]},
        format="json",
    )

    assert verify.status_code == 200
    assert verify.data["user"]["phone"] == registered_worker
    assert verify.data["user"]["role"] == User.Role.HEALTH_WORKER
    assert verify.data["access"]
    assert verify.data["refresh"]
    assert OTPChallenge.objects.get(phone=registered_worker).consumed_at is not None


@pytest.mark.parametrize(
    "request_phone,verify_phone",
    [
        ("+919876543210", "9876543210"),
        ("9876543210", "+919876543210"),
        ("919876543210", "+919876543210"),
        ("+919876543210", "919876543210"),
    ],
)
@pytest.mark.django_db
@override_settings(EXPOSE_DEBUG_OTP=True)
def test_otp_phone_format_mismatch(api_client, registered_worker, request_phone, verify_phone):
    """Verify works even when request and verify use different phone formats."""
    resp = api_client.post("/api/v1/auth/otp/request/", {"phone": request_phone}, format="json")
    assert resp.status_code == 201

    verify = api_client.post(
        "/api/v1/auth/otp/verify/",
        {"phone": verify_phone, "code": resp.data["debug_otp"]},
        format="json",
    )
    assert verify.status_code == 200, f"Failed: request={request_phone}, verify={verify_phone}"
    assert verify.data["access"]


@pytest.mark.django_db
@override_settings(EXPOSE_DEBUG_OTP=True)
def test_otp_wrong_code_fails(api_client, registered_worker):
    api_client.post("/api/v1/auth/otp/request/", {"phone": registered_worker}, format="json")

    resp = api_client.post(
        "/api/v1/auth/otp/verify/",
        {"phone": registered_worker, "code": "000000"},
        format="json",
    )
    assert resp.status_code == 400
    assert "Invalid or expired OTP" in str(resp.data)


@pytest.mark.django_db
@override_settings(EXPOSE_DEBUG_OTP=True)
def test_otp_expired_code_fails(api_client, registered_worker):
    resp = api_client.post("/api/v1/auth/otp/request/", {"phone": registered_worker}, format="json")
    code = resp.data["debug_otp"]

    challenge = OTPChallenge.objects.get(phone=registered_worker)
    challenge.expires_at = challenge.expires_at.replace(year=2020)
    challenge.save(update_fields=["expires_at"])

    verify = api_client.post(
        "/api/v1/auth/otp/verify/",
        {"phone": registered_worker, "code": code},
        format="json",
    )
    assert verify.status_code == 400
    assert "Invalid or expired OTP" in str(verify.data)


@pytest.mark.django_db
@override_settings(EXPOSE_DEBUG_OTP=True)
def test_otp_max_attempts_locks_out(api_client, registered_worker):
    resp = api_client.post("/api/v1/auth/otp/request/", {"phone": registered_worker}, format="json")
    code = resp.data["debug_otp"]

    for i in range(4):
        r = api_client.post(
            "/api/v1/auth/otp/verify/",
            {"phone": registered_worker, "code": "000000"},
            format="json",
        )
        assert r.status_code == 400

    # 5th attempt with correct code should still fail (maxed out)
    verify = api_client.post(
        "/api/v1/auth/otp/verify/",
        {"phone": registered_worker, "code": code},
        format="json",
    )
    assert verify.status_code == 400
    assert "Invalid or expired OTP" in str(verify.data)


@pytest.mark.django_db
def test_otp_no_challenge_fails(api_client):
    resp = api_client.post(
        "/api/v1/auth/otp/verify/",
        {"phone": "+919876543210", "code": "123456"},
        format="json",
    )
    assert resp.status_code == 400
    assert "No OTP challenge found" in str(resp.data)


@pytest.mark.django_db
@override_settings(EXPOSE_DEBUG_OTP=False)
def test_otp_debug_otp_hidden_in_prod(api_client, registered_worker):
    resp = api_client.post("/api/v1/auth/otp/request/", {"phone": registered_worker}, format="json")
    assert resp.status_code == 201
    assert "debug_otp" not in resp.data


# ─── Cleanup task ───


@pytest.mark.django_db
def test_cleanup_expired_otp_challenges(registered_worker):
    from accounts.tasks import cleanup_expired_otp_challenges

    OTPChallenge.create_for_code(phone=registered_worker, code="111111")
    challenge = OTPChallenge.objects.get(phone=registered_worker)
    challenge.expires_at = challenge.expires_at.replace(year=2020)
    challenge.save(update_fields=["expires_at"])

    assert OTPChallenge.objects.filter(phone=registered_worker).count() == 1
    deleted = cleanup_expired_otp_challenges()
    assert deleted == 1
    assert OTPChallenge.objects.filter(phone=registered_worker).count() == 0


@pytest.mark.django_db
@override_settings(EXPOSE_DEBUG_OTP=True)
def test_otp_verify_supervisor_login_bypasses_registration(api_client):
    supervisor_phone = "+919000000000"
    # Create supervisor directly in the User table (no WorkerRegistration)
    User.objects.create_user(
        username="supervisor_test",
        phone=supervisor_phone,
        role=User.Role.SUPERVISOR,
    )

    # Request OTP
    resp = api_client.post("/api/v1/auth/otp/request/", {"phone": supervisor_phone}, format="json")
    assert resp.status_code == 201
    code = resp.data["debug_otp"]

    # Verify OTP
    verify = api_client.post(
        "/api/v1/auth/otp/verify/",
        {"phone": supervisor_phone, "code": code},
        format="json",
    )
    assert verify.status_code == 200
    assert verify.data["user"]["phone"] == supervisor_phone
    assert verify.data["user"]["role"] == User.Role.SUPERVISOR
    assert verify.data["access"]
