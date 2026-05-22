import secrets
from datetime import timedelta

import bcrypt
from django.conf import settings
from django.utils import timezone

from followups.models import VisitVerificationOTP

OTP_VALIDITY_MINUTES = 15
OTP_LENGTH = 4
MAX_ATTEMPTS = 3


def generate_and_send(patient, asha_worker, household=None):
    has_phone = bool(household and getattr(household, "phone", None))
    phone = household.phone if has_phone else (patient.phone or "")
    sent_to = phone[-4:] if phone else ""

    if not has_phone and not patient.phone:
        return {"status": "no_phone", "message": "Household has no registered phone", "fallback": "bypass_available"}

    otp = "".join([str(secrets.randbelow(10)) for _ in range(OTP_LENGTH)])
    otp_hash = bcrypt.hashpw(otp.encode(), bcrypt.gensalt()).decode()

    record = VisitVerificationOTP.objects.create(
        patient=patient,
        asha_worker=asha_worker,
        otp_hash=otp_hash,
        sent_to_phone=phone,
        expires_at=timezone.now() + timedelta(minutes=OTP_VALIDITY_MINUTES),
    )

    result = {
        "status": "sent",
        "otp_id": str(record.pk),
        "sent_to_masked": f"+91 ••••••{sent_to}",
        "expires_in_seconds": OTP_VALIDITY_MINUTES * 60,
    }
    if getattr(settings, "EXPOSE_DEBUG_OTP", False):
        result["debug_otp"] = otp
    print(f"[VISIT OTP] {phone}: {otp}")

    return result


def verify(otp_id, otp_input):
    try:
        record = VisitVerificationOTP.objects.get(pk=otp_id)
    except VisitVerificationOTP.DoesNotExist:
        raise ValueError("Invalid OTP")

    if record.is_used:
        raise ValueError("OTP already used")
    if record.expires_at < timezone.now():
        raise ValueError("OTP expired. Request a new one.")
    if record.attempt_count >= MAX_ATTEMPTS:
        raise ValueError("Too many attempts. Request new OTP.")

    is_valid = bcrypt.checkpw(otp_input.encode(), record.otp_hash.encode())
    if not is_valid:
        record.attempt_count += 1
        record.save(update_fields=["attempt_count"])
        remaining = MAX_ATTEMPTS - record.attempt_count
        raise ValueError(f"Wrong OTP. {remaining} attempts left.")

    record.is_used = True
    record.verified_at = timezone.now()
    record.save(update_fields=["is_used", "verified_at"])
    return True


def apply_bypass(patient, asha_worker, reason):
    VisitVerificationOTP.objects.create(
        patient=patient,
        asha_worker=asha_worker,
        otp_hash="BYPASS",
        sent_to_phone="NONE",
        expires_at=timezone.now(),
        is_used=True,
        bypass_reason=reason,
        verified_at=timezone.now(),
    )
    return {"status": "bypassed", "reason": reason}
