#!/usr/bin/env python3
import sys
import time

import requests

from _http import API, api_available, auth_headers, now_ms, request_otp, verify_otp

PHONE_A = "+919988776603"
PHONE_B = "+919988776604"
PATIENT_B = "eval-patient-worker-b"


def main() -> int:
    if not api_available():
        print("SKIP API not reachable")
        return 0
    otp_b = request_otp(PHONE_B)
    token_b = verify_otp(PHONE_B, otp_b)
    headers_b = auth_headers(token_b)

    # Resolve worker B id via verify response not available — push assigns worker
    ts = now_ms()
    push_b = {
        "changes": {
            "patients": {
                "created": [
                    {
                        "id": PATIENT_B,
                        "patient_code": "EVAL-B",
                        "name": "Worker B Patient",
                        "is_synced": False,
                        "created_at": ts,
                        "updated_at": ts,
                        "is_deleted": False,
                        "is_mock": True,
                    }
                ],
                "updated": [],
                "deleted": [],
            }
        }
    }
    requests.post(f"{API}/sync/push/", json=push_b, headers=headers_b, timeout=15).raise_for_status()

    otp_a = request_otp(PHONE_A)
    token_a = verify_otp(PHONE_A, otp_a)
    pull_a = requests.get(
        f"{API}/sync/pull/", params={"last_pulled_at": 0}, headers=auth_headers(token_a), timeout=15
    )
    pull_a.raise_for_status()
    ids = {r["id"] for r in pull_a.json()["changes"]["patients"]["created"]}
    ids.update(r["id"] for r in pull_a.json()["changes"]["patients"]["updated"])
    if PATIENT_B in ids:
        print("FAIL worker A can see worker B patient")
        return 1
    print("PASS worker_scope")
    return 0


if __name__ == "__main__":
    sys.exit(main())
