import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30, name="accounts.send_otp_sms")
def send_otp_sms_task(self, phone, code):
    from .sms import send_otp_sms

    try:
        success = send_otp_sms(phone, code)
        if not success:
            logger.warning("send_otp_sms returned False for %s (will not retry)", phone)
        return success
    except Exception as exc:
        logger.exception("send_otp_sms failed for %s", phone)
        raise self.retry(exc=exc)


@shared_task(name="accounts.cleanup_expired_otp")
def cleanup_expired_otp_challenges():
    from django.utils import timezone

    from .models import OTPChallenge

    deleted, _ = OTPChallenge.objects.filter(
        expires_at__lt=timezone.now(),
    ).delete()
    if deleted:
        logger.info("Cleaned up %d expired OTP challenges", deleted)
    return deleted
