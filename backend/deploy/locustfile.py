"""
Locust load test for Shaasthi API.

Run:
    locust -f deploy/locustfile.py --host=https://staging-api.shaasthi.in --users=100 --spawn-rate=10
"""
import random
import uuid

from locust import HttpUser, between, task

GEOGRAPHIES = [
    {"region": "R1", "district": "D1", "block": "B1", "village": "V1"},
    {"region": "R1", "district": "D1", "block": "B1", "village": "V2"},
    {"region": "R1", "district": "D1", "block": "B2", "village": "V3"},
]


class ShaasthiUser(HttpUser):
    wait_time = between(2, 5)  # seconds between tasks

    def on_start(self):
        """Simulate worker login and cache auth token."""
        self.phone = f"+9199{random.randint(10000000, 99999999)}"
        self.geo = random.choice(GEOGRAPHIES)
        self.token = None
        self.patient_ids = []
        self.household_ids = []

        # Request OTP (dev mode returns OTP in response)
        with self.client.post(
            "/api/v1/auth/otp/request/",
            json={"phone": self.phone},
            catch_response=True,
        ) as resp:
            if resp.status_code == 200:
                data = resp.json()
                otp = data.get("otp", "000000")
                # Verify OTP
                with self.client.post(
                    "/api/v1/auth/otp/verify/",
                    json={"phone": self.phone, "otp": str(otp)},
                    catch_response=True,
                ) as verify:
                    if verify.status_code == 200:
                        self.token = verify.json().get("access")

    @task(5)
    def sync_pull(self):
        """Pull latest data from server."""
        if not self.token:
            return
        self.client.post(
            "/api/v1/sync/pull/",
            json={
                "last_pulled_at": None,
                "limit": 100,
                "table_names": [
                    "patients", "households", "survey_responses",
                    "follow_ups", "flags", "referrals",
                ],
            },
            headers={"Authorization": f"Bearer {self.token}"},
        )

    @task(3)
    def sync_push(self):
        """Push a new survey response."""
        if not self.token:
            return
        patient_id = str(uuid.uuid4())
        household_id = str(uuid.uuid4())
        survey_id = str(uuid.uuid4())

        self.client.post(
            "/api/v1/sync/push/",
            json={
                "changes": {
                    "patients": {
                        "created": [
                            {
                                "id": patient_id,
                                "name": f"Patient-{random.randint(1,99999)}",
                                "age": random.randint(18, 80),
                                "gender": random.choice(["M", "F", "O"]),
                                "phone": f"+9199{random.randint(10000000, 99999999)}",
                                "household_id": household_id,
                                "created_at": int(__import__("time").time() * 1000),
                                "updated_at": int(__import__("time").time() * 1000),
                            }
                        ],
                        "updated": [],
                        "deleted": [],
                    },
                    "households": {
                        "created": [
                            {
                                "id": household_id,
                                "name": "Load Test HH",
                                "head_of_family": "Test Head",
                                "village": self.geo["village"],
                                "block": self.geo["block"],
                                "district": self.geo["district"],
                                "region": self.geo["region"],
                                "created_at": int(__import__("time").time() * 1000),
                                "updated_at": int(__import__("time").time() * 1000),
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
                                "answers": {"q1": "yes", "q2": "no"},
                                "created_at": int(__import__("time").time() * 1000),
                                "updated_at": int(__import__("time").time() * 1000),
                            }
                        ],
                        "updated": [],
                        "deleted": [],
                    },
                }
            },
            headers={"Authorization": f"Bearer {self.token}"},
        )

    @task(2)
    def patient_list(self):
        """Fetch paginated patient list."""
        if not self.token:
            return
        self.client.get(
            "/api/v1/registry/patients/",
            headers={"Authorization": f"Bearer {self.token}"},
        )

    @task(1)
    def dashboard_summary(self):
        """Fetch dashboard summary (supervisors only)."""
        if not self.token:
            return
        self.client.get(
            "/api/v1/dashboard/summary/",
            headers={"Authorization": f"Bearer {self.token}"},
        )

    @task(1)
    def health_check(self):
        """Lightweight health check."""
        self.client.get("/health/")
