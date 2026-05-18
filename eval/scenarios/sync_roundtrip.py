#!/usr/bin/env python3
import json
import sys
from pathlib import Path

import requests

from _http import API, api_available, auth_headers, now_ms, request_otp, verify_otp

PHONE = "+919988776602"
FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "survey_payloads.json"


def main() -> int:
    if not api_available():
        print("SKIP API not reachable")
        return 0
    otp = request_otp(PHONE)
    token = verify_otp(PHONE, otp)
    headers = auth_headers(token)
    
    # Assign village to user so they can pull patients
    me_resp = requests.get(f"{API}/auth/users/me/", headers=headers).json()
    requests.patch(f"{API}/auth/users/{me_resp['id']}/", json={"village": "South"}, headers=headers)
    
    ts = now_ms()
    patient_id = "c2d3e4f5-a6b7-4c8d-9e0f-1a2b3c4d5e6f"
    payloads = json.loads(FIXTURES.read_text(encoding="utf-8"))
    survey_id = "d3e4f5a6-b7c8-4d9e-0f1a-2b3c4d5e6f7a"

    push = {
        "changes": {
            "patients": {
                "created": [
                    {
                        "id": patient_id,
                        "patient_code": "EVAL-P-1",
                        "full_name": "Eval Patient",
                        "village": "South",
                        "asha_worker_server_id": None,
                        "is_synced": False,
                        "created_at": ts,
                        "updated_at": ts,
                        "is_deleted": False,
                        "is_mock": True,
                    }
                ],
                "updated": [],
                "deleted": [],
            },
            "survey_responses": {
                "created": [
                    {
                        "id": survey_id,
                        "patient_id": patient_id,
                        "survey_date": "2026-05-18",
                        **payloads["tb_cluster"],
                        "is_synced": False,
                        "created_at": ts,
                        "updated_at": ts,
                        "is_deleted": False,
                        "is_mock": True,
                    }
                ],
                "updated": [],
                "deleted": [],
            },
        }
    }
    pr = requests.post(f"{API}/sync/push/", json=push, headers=headers, timeout=15)
    print("Push Resp:", pr.json())
    if pr.status_code != 200:
        print("FAIL push", pr.status_code, pr.text)
        return 1
    pull = requests.get(f"{API}/sync/pull/", params={"last_pulled_at": 0}, headers=headers, timeout=15)
    if pull.status_code != 200:
        print("FAIL pull", pull.status_code)
        return 1
    created = pull.json()["changes"]["patients"]["created"] + pull.json()["changes"]["patients"]["updated"]
    ids = {r["id"] for r in created}
    if patient_id not in ids:
        print("FAIL patient not in pull", ids)
        print("Me Resp:", requests.get(f"{API}/auth/users/me/", headers=headers).json())
        print("Pull Resp:", pull.json())
        return 1
    surveys = pull.json()["changes"]["survey_responses"]["created"] + pull.json()["changes"]["survey_responses"]["updated"]
    if not any(s.get("id") == survey_id or s.get("patient_id") == patient_id for s in surveys):
        print("FAIL survey not in pull")
        return 1
    print("PASS sync_roundtrip")
    return 0


if __name__ == "__main__":
    sys.exit(main())
