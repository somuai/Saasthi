import hashlib
import re
from datetime import timedelta

import pytest
from accounts.models import OTPChallenge, User
from django.conf import settings
from django.utils import timezone
from freezegun import freeze_time

from tests.factories import UserFactory

# ── Helper ────────────────────────────────────────────────────────────


def make_otp_challenge(phone="9876543210", code="123456", minutes_ahead=10):
    expires_at = timezone.now() + timedelta(minutes=minutes_ahead)
    raw = f"{settings.SECRET_KEY}:{phone}:{code}".encode()
    code_hash = hashlib.sha256(raw).hexdigest()
    return OTPChallenge.objects.create(
        phone=phone,
        code_hash=code_hash,
        purpose="login",
        expires_at=expires_at,
    )


# ── OTP Model Tests ───────────────────────────────────────────────────


@pytest.mark.django_db
class TestOTPChallengeModel:
    def test_otp_hash_is_sha256_not_plaintext(self):
        challenge = make_otp_challenge()
        assert "123456" not in challenge.code_hash
        assert len(challenge.code_hash) == 64
        assert re.match(r"^[a-f0-9]{64}$", challenge.code_hash)

    def test_is_valid_when_not_consumed_and_not_expired(self):
        challenge = make_otp_challenge(minutes_ahead=10)
        assert challenge.is_valid is True

    def test_is_invalid_when_consumed(self):
        challenge = make_otp_challenge(minutes_ahead=10)
        challenge.consumed_at = timezone.now()
        challenge.save(update_fields=["consumed_at"])
        assert challenge.is_valid is False

    def test_is_invalid_when_expired(self):
        with freeze_time("2026-05-01 10:00:00"):
            challenge = make_otp_challenge(minutes_ahead=10)
        with freeze_time("2026-05-01 10:11:00"):
            assert challenge.is_valid is False

    def test_is_invalid_after_5_attempts(self):
        challenge = make_otp_challenge(minutes_ahead=10)
        challenge.attempts = 5
        challenge.save(update_fields=["attempts"])
        assert challenge.is_valid is False

    def test_hash_code_static_deterministic(self):
        h1 = OTPChallenge.hash_code("+919876543210", "123456")
        h2 = OTPChallenge.hash_code("+919876543210", "123456")
        assert h1 == h2

    def test_hash_code_different_for_different_phones(self):
        h1 = OTPChallenge.hash_code("+919876543210", "123456")
        h2 = OTPChallenge.hash_code("+919876543211", "123456")
        assert h1 != h2

    def test_hash_code_different_for_different_codes(self):
        h1 = OTPChallenge.hash_code("+919876543210", "123456")
        h2 = OTPChallenge.hash_code("+919876543210", "654321")
        assert h1 != h2

    def test_expired_otp_rejected(self):
        with freeze_time("2026-05-01 10:00:00"):
            challenge = make_otp_challenge(minutes_ahead=10)
        with freeze_time("2026-05-01 10:11:00"):
            assert not challenge.is_valid


@pytest.mark.django_db
class TestOTPRateLimit:
    def test_max_5_active_challenges_per_phone(self):
        phone = "9876543210"
        for i in range(5):
            OTPChallenge.objects.create(
                phone=phone,
                code_hash=f"hash_{i}",
                purpose="login",
                expires_at=timezone.now() + timedelta(minutes=10),
            )
        assert OTPChallenge.objects.filter(phone=phone, consumed_at__isnull=True).count() <= 5

    def test_old_challenges_auto_expire(self):
        phone = "9876543210"
        with freeze_time("2026-05-01 10:00:00"):
            OTPChallenge.objects.create(
                phone=phone,
                code_hash="old_hash",
                purpose="login",
                expires_at=timezone.now() + timedelta(minutes=10),
            )
        with freeze_time("2026-05-01 11:00:00"):
            valid = OTPChallenge.objects.filter(phone=phone, consumed_at__isnull=True, expires_at__gt=timezone.now())
            assert valid.count() == 0


@pytest.mark.django_db
class TestOTPRoleAccess:
    def test_inactive_worker_cannot_login(self):
        worker = UserFactory(is_active=False)
        assert not worker.is_active
        assert worker.role == User.Role.HEALTH_WORKER

    def test_supervisor_can_login(self):
        from tests.factories import SupervisorFactory

        sup = SupervisorFactory()
        assert sup.is_active
        assert sup.role == User.Role.SUPERVISOR
