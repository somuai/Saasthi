import logging

logger = logging.getLogger(__name__)


def send_otp_sms(phone, code):
    logger.info(f"OTP for {phone}: {code} — SMS delivery handled by Firebase.")
    return True
