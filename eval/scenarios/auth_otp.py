#!/usr/bin/env python3
import sys

import requests
from _http import API, api_available, request_otp, verify_otp

PHONE = "+919988776601"


def main() -> int:
    if not api_available():
        print("SKIP API not reachable")
        return 0
    otp = request_otp(PHONE)
    token = verify_otp(PHONE, otp)
    if not token:
        print("FAIL no access token")
        return 1
    bad = requests.post(f"{API}/auth/otp/verify/", json={"phone": PHONE, "otp": "000000"}, timeout=10)
    if bad.status_code == 200:
        print("FAIL bad OTP accepted")
        return 1
    print("PASS auth_otp")
    return 0


if __name__ == "__main__":
    sys.exit(main())
