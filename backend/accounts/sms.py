import logging
import re

from django.conf import settings

logger = logging.getLogger(__name__)


def send_otp_sms(phone, code):
    """
    Dispatches an OTP SMS via the configured provider.
    Primary: Firebase Phone Auth handles mobile OTP natively.
    Fallback: Used by web/supervisor clients that can't use Firebase SDK.
    """
    provider = getattr(settings, "SMS_PROVIDER", "log").strip().lower()
    if provider == "msg91":
        return _send_via_msg91(phone, code)
    else:
        logger.info("OTP for %s: %s (SMS_PROVIDER=%s, no real gateway configured)", phone, code, provider)
        return True


def _msg91_phone(phone):
    """MSG91 expects 91XXXXXXXXXX (no +, no leading 0)."""
    cleaned = re.sub(r"[^\d]", "", phone)
    if len(cleaned) == 12 and cleaned.startswith("91"):
        return cleaned
    if len(cleaned) == 10:
        return f"91{cleaned}"
    if cleaned.startswith("91"):
        return cleaned
    return f"91{cleaned}"


def _send_via_msg91(phone, code):
    api_key = getattr(settings, "SMS_API_KEY", "")
    sender_id = getattr(settings, "SMS_SENDER_ID", "SHASTH")
    template_id = getattr(settings, "SMS_TEMPLATE_ID", "")

    if not api_key:
        logger.warning("MSG91 API key not configured. OTP %s for %s not sent.", code, phone)
        return False

    import requests

    mobile = _msg91_phone(phone)
    message = (
        f"Your Saasthi OTP is {code}. "
        f"It is valid for {getattr(settings, 'OTP_TTL_MINUTES', 10)} minutes. "
        "Do not share this OTP with anyone."
    )

    params = {
        "authkey": api_key,
        "mobiles": mobile,
        "sender": sender_id,
        "route": "4",
        "country": "91",
        "unicode": "1",
        "message": message,
    }
    if template_id:
        params["DLT_TE_ID"] = template_id

    try:
        resp = requests.get(
            "https://api.msg91.com/api/sendhttp.php",
            params=params,
            timeout=10,
        )
        text = resp.text.strip()
        # MSG91 returns "Please provide authkey" on error, or a message ID on success
        if not resp.ok or "Please provide" in text or "error" in text.lower():
            logger.error("MSG91 API error for %s: HTTP %s — %s", phone, resp.status_code, text)
            return False
        logger.info("MSG91 SMS sent to %s (OTP: %s) — response: %s", phone, code, text)
        return True
    except requests.RequestException:
        logger.exception("MSG91 SMS failed for %s", phone)
        return False
