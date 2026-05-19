import urllib.request
import urllib.parse
import urllib.error
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

def send_otp_sms(phone, code):
    if not settings.MSG91_AUTH_KEY or not settings.MSG91_TEMPLATE_ID:
        logger.warning(f"MSG91 credentials not configured. Skipping SMS for {phone} with code {code}.")
        return False
        
    url = "https://control.msg91.com/api/v5/otp"
    params = {
        "template_id": settings.MSG91_TEMPLATE_ID,
        "mobile": phone,
        "authkey": settings.MSG91_AUTH_KEY,
        "otp": code
    }
    query_string = urllib.parse.urlencode(params)
    full_url = f"{url}?{query_string}"
    
    try:
        req = urllib.request.Request(full_url, method="POST")
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, data=b"{}") as response:
            if response.status == 200:
                logger.info(f"Successfully sent OTP to {phone}")
                return True
            else:
                logger.error(f"Failed to send OTP. MSG91 status: {response.status}")
                return False
    except urllib.error.URLError as e:
        logger.error(f"URLError sending OTP via MSG91: {e}")
        return False
