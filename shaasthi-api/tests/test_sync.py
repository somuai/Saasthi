import uuid

import pytest
from django.utils import timezone

from accounts.models import User
from registry.models import Household, Patient
from sync.models import SyncEvent


# ── Helpers ──────────────────────────────────────────────────


def push_payload(changes=None, **overrides):
    payload = {
        "device_id": "test-device-1",
        "changes": changes or {},
    }
    payload.update(overrides)
    return payload


def patient_created(patient_uuid=None, **extra):
    return {
        "created": [
            {
                "id": str(patient_uuid or uuid.uuid4()),
                "full_name": "Test Patient",
                "gender": "female",
                "village": "Test Village",
                **extra,
            }
        ],
        "updated": [],
        "deleted": [],
    }


# ── Push: Create ─────────────────────────────────────────────


@pytest.mark.django_db
def test_push_create_patient(auth_client):
    puid = uuid.uuid4()
    resp = auth_client.post("/api/v1/sync/push/", push_payload({"patients": patient_created(puid)}), format="json")
    assert resp.status_code == 200
    assert resp.data["results"][0]["status"] == SyncEvent.Status.APPLIED
    assert Patient.objects.filter(local_uuid=puid).exists()


@pytest.mark.django_db
def test_push_create_household(auth_client):
    huid = uuid.uuid4()
    changes = {
        "households": {
            "created": [{"id": str(huid), "household_code": "HH-001", "village": "Test Village"}],
            "updated": [],
            "deleted": [],
        }
    }
    resp = auth_client.post("/api/v1/sync/push/", push_payload(changes), format="json")
    assert resp.status_code == 200
    assert resp.data["results"][0]["status"] == SyncEvent.Status.APPLIED
    assert Household.objects.filter(local_uuid=huid).exists()


@pytest.mark.django_db
def test_push_create_survey_response(auth_client, sample_patient):
    suid = uuid.uuid4()
    puid = sample_patient.local_uuid
    changes = {
        "survey_responses": {
            "created": [
                {
                    "id": str(suid),
                    "patient_id": str(puid),
                    "survey_type": "initial",
                    "answers": {"fever": True},
                    "submitted_at": timezone.now().isoformat(),
                }
            ],
            "updated": [],
            "deleted": [],
        }
    }
    resp = auth_client.post("/api/v1/sync/push/", push_payload(changes), format="json")
    assert resp.status_code == 200
    result = resp.data["results"][0]
    assert result["status"] == SyncEvent.Status.APPLIED


@pytest.mark.django_db
def test_push_create_flag(auth_client, sample_patient):
    flag_uid = uuid.uuid4()
    puid = sample_patient.local_uuid
    changes = {
        "flags": {
            "created": [
                {
                    "id": str(flag_uid),
                    "patient_id": str(puid),
                    "flag_type": "high_risk_maternal",
                    "severity": "high",
                    "source": "sync",
                }
            ],
            "updated": [],
            "deleted": [],
        }
    }
    resp = auth_client.post("/api/v1/sync/push/", push_payload(changes), format="json")
    assert resp.status_code == 200
    assert resp.data["results"][0]["status"] == SyncEvent.Status.APPLIED


# ── Push: Dedup & Update ─────────────────────────────────────


@pytest.mark.django_db
def test_push_dedup_by_event_uuid(auth_client):
    event_uuid = uuid.uuid4()
    puid = uuid.uuid4()
    payload = push_payload({"patients": patient_created(puid, event_uuid=str(event_uuid))})

    first = auth_client.post("/api/v1/sync/push/", payload, format="json")
    second = auth_client.post("/api/v1/sync/push/", payload, format="json")

    assert first.data["results"][0]["status"] == SyncEvent.Status.APPLIED
    assert second.data["results"][0]["status"] == SyncEvent.Status.DUPLICATE
    assert Patient.objects.count() == 1


@pytest.mark.django_db
def test_push_update_same_local_uuid(auth_client):
    """Different event_uuid, same local_uuid should update the record."""
    puid = uuid.uuid4()
    create_payload = push_payload({
        "patients": {
            "created": [{"id": str(puid), "full_name": "Original", "gender": "female", "event_uuid": str(uuid.uuid4())}],
            "updated": [],
            "deleted": [],
        }
    })
    auth_client.post("/api/v1/sync/push/", create_payload, format="json")

    update_payload = push_payload({
        "patients": {
            "created": [],
            "updated": [{"id": str(puid), "full_name": "Updated", "gender": "female", "event_uuid": str(uuid.uuid4())}],
            "deleted": [],
        }
    })
    resp = auth_client.post("/api/v1/sync/push/", update_payload, format="json")

    assert resp.data["results"][0]["status"] == SyncEvent.Status.APPLIED
    assert Patient.objects.get(local_uuid=puid).full_name == "Updated"
    assert SyncEvent.objects.count() == 2


# ── Push: Delete ─────────────────────────────────────────────


@pytest.mark.django_db
def test_push_delete_patient(auth_client):
    # Create a patient first
    puid = uuid.uuid4()
    auth_client.post("/api/v1/sync/push/", push_payload({"patients": patient_created(puid)}), format="json")
    assert Patient.objects.filter(local_uuid=puid).exists()

    # Delete via sync
    delete_payload = push_payload({
        "patients": {"created": [], "updated": [], "deleted": [str(puid)]}
    })
    resp = auth_client.post("/api/v1/sync/push/", delete_payload, format="json")

    assert resp.status_code == 200
    assert resp.data["results"][0]["status"] == SyncEvent.Status.APPLIED
    assert not Patient.objects.filter(local_uuid=puid).exists()


@pytest.mark.django_db
def test_push_delete_household_soft(auth_client):
    huid = uuid.uuid4()
    auth_client.post(
        "/api/v1/sync/push/",
        push_payload({
            "households": {
                "created": [{"id": str(huid), "household_code": "HH-001"}],
                "updated": [],
                "deleted": [],
            }
        }),
        format="json",
    )
    assert Household.objects.filter(local_uuid=huid, is_active=True).exists()

    resp = auth_client.post(
        "/api/v1/sync/push/",
        push_payload({
            "households": {"created": [], "updated": [], "deleted": [str(huid)]}
        }),
        format="json",
    )

    assert resp.status_code == 200
    assert not Household.objects.get(local_uuid=huid).is_active


# ── Push: Data Isolation ─────────────────────────────────────


@pytest.mark.django_db
def test_push_data_isolation_rejects_wrong_geography(auth_client, sample_patient):
    """A user from a different village cannot push data referencing a patient they don't own."""
    other_user = User.objects.create_user(
        username="other_worker",
        phone="+919999999998",
        password="testpass123",
        role=User.Role.HEALTH_WORKER,
        village="OtherVillage",
    )
    from rest_framework.test import APIClient
    from rest_framework_simplejwt.tokens import AccessToken

    client = APIClient()
    token = AccessToken.for_user(other_user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    suid = uuid.uuid4()
    changes = {
        "survey_responses": {
            "created": [
                {
                    "id": str(suid),
                    "patient_id": str(sample_patient.local_uuid),
                    "survey_type": "initial",
                    "answers": {},
                }
            ],
            "updated": [],
            "deleted": [],
        }
    }
    resp = client.post("/api/v1/sync/push/", push_payload(changes), format="json")
    assert resp.status_code == 200
    assert resp.data["results"][0]["status"] == SyncEvent.Status.ERROR
    assert "access" in resp.data["results"][0].get("message", "").lower()


# ── Push: Survey response sets synced_at ─────────────────────


@pytest.mark.django_db
def test_push_survey_response_sets_synced_at(auth_client, sample_patient):
    suid = uuid.uuid4()
    changes = {
        "survey_responses": {
            "created": [
                {
                    "id": str(suid),
                    "patient_id": str(sample_patient.local_uuid),
                    "survey_type": "followup",
                    "answers": {},
                    "submitted_at": timezone.now().isoformat(),
                }
            ],
            "updated": [],
            "deleted": [],
        }
    }
    auth_client.post("/api/v1/sync/push/", push_payload(changes), format="json")
    from surveys.models import SurveyResponse
    sr = SurveyResponse.objects.get(local_uuid=suid)
    assert sr.synced_at is not None


# ── Pull ─────────────────────────────────────────────────────


@pytest.mark.django_db
def test_pull_returns_data(auth_client):
    """Pull should return changes with proper structure."""
    resp = auth_client.get("/api/v1/sync/pull/", {"last_pulled_at": "0"})
    assert resp.status_code == 200
    assert "changes" in resp.data
    assert "timestamp" in resp.data
    for table in ("patients", "households", "survey_responses"):
        assert table in resp.data["changes"]
        assert "created" in resp.data["changes"][table]
        assert "updated" in resp.data["changes"][table]
        assert "deleted" in resp.data["changes"][table]


@pytest.mark.django_db
def test_pull_respects_geography(auth_client, sample_patient):
    """Pull should only return patients in the user's geography."""
    other_village = User.objects.create_user(
        username="far_village_worker",
        phone="+919999999997",
        password="testpass123",
        role=User.Role.HEALTH_WORKER,
        village="FarAwayVillage",
    )
    from rest_framework.test import APIClient
    from rest_framework_simplejwt.tokens import AccessToken

    client = APIClient()
    token = AccessToken.for_user(other_village)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

    resp = client.get("/api/v1/sync/pull/", {"last_pulled_at": "0"})
    assert resp.status_code == 200
    assert len(resp.data["changes"]["patients"]["created"]) == 0


# ── Pull: created vs updated categorization ──────────────────


@pytest.mark.django_db
def test_pull_categorizes_created_vs_updated(auth_client, sample_patient):
    """Pull should return new records as 'created' and edits as 'updated'."""
    # Pull to get baseline timestamp
    resp1 = auth_client.get("/api/v1/sync/pull/", {"last_pulled_at": "0"})
    ts = resp1.data["timestamp"]

    # Edit the patient
    sample_patient.full_name = "Updated Name"
    sample_patient.save()

    # Pull again with the old timestamp
    resp2 = auth_client.get("/api/v1/sync/pull/", {"last_pulled_at": str(ts)})
    patients = resp2.data["changes"]["patients"]

    assert len(patients["created"]) == 0, "No new patients should be created"
    assert len(patients["updated"]) >= 1, "The updated patient should appear in 'updated'"
    updated_names = [p["full_name"] for p in patients["updated"]]
    assert "Updated Name" in updated_names


# ── Push: FK resolution ──────────────────────────────────────


@pytest.mark.django_db
def test_push_household_fk_on_patient(auth_client):
    """Patient with household_id should resolve the FK correctly."""
    huid = uuid.uuid4()
    auth_client.post(
        "/api/v1/sync/push/",
        push_payload({
            "households": {
                "created": [{"id": str(huid), "household_code": "HH-FK"}],
                "updated": [],
                "deleted": [],
            }
        }),
        format="json",
    )

    puid = uuid.uuid4()
    resp = auth_client.post(
        "/api/v1/sync/push/",
        push_payload({
            "patients": {
                "created": [{
                    "id": str(puid),
                    "full_name": "FK Patient",
                    "household_id": str(huid),
                    "village": "Test",
                }],
                "updated": [], "deleted": [],
            }
        }),
        format="json",
    )

    assert resp.status_code == 200
    patient = Patient.objects.get(local_uuid=puid)
    assert patient.household is not None
    assert patient.household.local_uuid == huid


# ── Push: invalid model is silently skipped ──────────────────


@pytest.mark.django_db
def test_push_skips_unknown_table(auth_client):
    changes = {
        "unknown_table": {
            "created": [{"id": str(uuid.uuid4()), "some_field": "value"}],
            "updated": [],
            "deleted": [],
        }
    }
    resp = auth_client.post("/api/v1/sync/push/", push_payload(changes), format="json")
    assert resp.status_code == 200
    assert len(resp.data["results"]) == 0


# ── Pull: returns correct FK IDs ─────────────────────────────


@pytest.mark.django_db
def test_pull_returns_correct_fk_ids(auth_client, sample_patient):
    """Survey responses in pull should have patient_id matching patient local_uuid."""
    from surveys.models import SurveyResponse

    sr = SurveyResponse.objects.create(
        local_uuid=uuid.uuid4(),
        patient=sample_patient,
        survey_type="test",
        answers={},
    )

    resp = auth_client.get("/api/v1/sync/pull/", {"last_pulled_at": "0"})
    surveys = resp.data["changes"]["survey_responses"]["created"]
    matching = [s for s in surveys if s["id"] == str(sr.local_uuid)]
    assert len(matching) == 1
    assert matching[0]["patient_id"] == str(sample_patient.local_uuid)
