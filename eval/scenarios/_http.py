import os
import time

import requests

BASE = os.getenv("SHAASTHI_API_URL", "http://127.0.0.1:8000").rstrip("/")
API = f"{BASE}/api/v1"


def api_available() -> bool:
    try:
        requests.get(f"{BASE}/api/schema/", timeout=2)
        return True
    except Exception:
        return False


def request_otp(phone: str = "+919988776655") -> str:
    for attempt in range(3):
        r = requests.post(f"{API}/auth/otp/request/", json={"phone": phone}, timeout=10)
        if r.status_code == 429 and attempt < 2:
            time.sleep(2)
            continue
        r.raise_for_status()
        break
    data = r.json()
    otp = data.get("debug_otp") or data.get("dev_otp")
    if not otp:
        raise RuntimeError("dev_otp missing — use development settings")
    return otp


def verify_otp(phone: str, otp: str) -> str:
    r = requests.post(f"{API}/auth/otp/verify/", json={"phone": phone, "code": otp}, timeout=10)
    r.raise_for_status()
    return r.json()["access"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def now_ms() -> int:
    return int(time.time() * 1000)
