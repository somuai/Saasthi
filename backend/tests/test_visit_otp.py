import pytest
from django.test import override_settings
from followups.models import VisitVerificationOTP
from followups.services import visit_otp_service

from tests.factories import PatientFactory, UserFactory


@pytest.mark.django_db
@override_settings(EXPOSE_DEBUG_OTP=True)
def test_generate_and_send_creates_otp_record():
    worker = UserFactory()
    patient = PatientFactory(phone="+919876543210")
    result = visit_otp_service.generate_and_send(patient, worker)
    assert result["status"] == "sent"
    assert "debug_otp" in result
    assert VisitVerificationOTP.objects.count() == 1
    record = VisitVerificationOTP.objects.first()
    assert record.asha_worker == worker
    assert record.patient == patient
    assert record.is_used is False


@pytest.mark.django_db
@override_settings(EXPOSE_DEBUG_OTP=True)
def test_verify_valid_otp():
    worker = UserFactory()
    patient = PatientFactory(phone="+919876543210")
    result = visit_otp_service.generate_and_send(patient, worker)
    assert visit_otp_service.verify(result["otp_id"], result["debug_otp"]) is True


@pytest.mark.django_db
@override_settings(EXPOSE_DEBUG_OTP=True)
def test_verify_wrong_otp_increments_attempts():
    worker = UserFactory()
    patient = PatientFactory(phone="+919876543211")
    result = visit_otp_service.generate_and_send(patient, worker)
    with pytest.raises(ValueError, match="Wrong OTP"):
        visit_otp_service.verify(result["otp_id"], "0000")
    record = VisitVerificationOTP.objects.first()
    assert record.attempt_count == 1


@pytest.mark.django_db
def test_no_phone_returns_bypass_available():
    worker = UserFactory()
    patient = PatientFactory(phone="")
    result = visit_otp_service.generate_and_send(patient, worker)
    assert result["status"] == "no_phone"


@pytest.mark.django_db
def test_bypass_creates_record():
    worker = UserFactory()
    patient = PatientFactory()
    visit_otp_service.apply_bypass(patient, worker, "emergency")
    assert VisitVerificationOTP.objects.count() == 1
    record = VisitVerificationOTP.objects.first()
    assert record.is_used is True
    assert record.bypass_reason == "emergency"
