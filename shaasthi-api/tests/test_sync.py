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
    all_tables = [
        "patients", "households", "survey_responses", "follow_ups",
        "flags", "referrals", "mother_records", "immunization_records",
        "growth_records", "incentive_records", "anc_visit_records", "child_development",
    ]
    for table in all_tables:
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
    updated_names = [p["name"] for p in patients["updated"]]
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


# ── Pull: field mapping correctness ──────────────────────────


@pytest.mark.django_db
def test_pull_patient_has_wm_field_names(auth_client, sample_patient):
    """Pull patients should use WatermelonDB column names (e.g. 'name' not 'full_name')."""
    resp = auth_client.get("/api/v1/sync/pull/", {"last_pulled_at": "0"})
    patients = resp.data["changes"]["patients"]["created"]
    patient = next((p for p in patients if p["id"] == str(sample_patient.local_uuid)), None)
    assert patient is not None, "Sample patient should appear in pull"
    assert "name" in patient, "Should use 'name' not 'full_name'"
    assert "full_name" not in patient, "Should NOT have Django 'full_name'"
    assert patient["name"] == sample_patient.full_name
    assert "created_at" in patient
    assert isinstance(patient["created_at"], int), "Timestamp should be int ms"
    assert patient["is_synced"] is True
    assert patient["is_mock"] is False
    assert "server_id" in patient
    assert "has_asthma" in patient, "Should include WM-only fields with defaults"


@pytest.mark.django_db
def test_pull_survey_uses_wm_field_names(auth_client, sample_patient):
    """Survey responses should use WatermelonDB column names."""
    from surveys.models import SurveyResponse

    sr = SurveyResponse.objects.create(
        local_uuid=uuid.uuid4(),
        patient=sample_patient,
        survey_type="initial",
        answers={"fever": True},
    )

    resp = auth_client.get("/api/v1/sync/pull/", {"last_pulled_at": "0"})
    surveys = resp.data["changes"]["survey_responses"]["created"]
    matching = [s for s in surveys if s["id"] == str(sr.local_uuid)]
    assert len(matching) == 1
    sv = matching[0]
    assert "survey_type" not in sv, "Should not include Django-only 'survey_type'"
    assert "patient_id" in sv, "Should include WM patient_id"
    assert sv["is_synced"] is True


@pytest.mark.django_db
def test_pull_household_uses_wm_field_names(auth_client, sample_patient):
    """Households should use WatermelonDB column names."""
    resp = auth_client.get("/api/v1/sync/pull/", {"last_pulled_at": "0"})
    households = resp.data["changes"]["households"]["created"]
    for hh in households:
        assert "head_of_family" in hh, "Should use 'head_of_family' not 'head_name'"
        assert "head_name" not in hh
        assert "total_members" in hh
        assert "gps_lat" in hh


# ── Pull: timestamp format ───────────────────────────────────


@pytest.mark.django_db
def test_pull_timestamps_are_milliseconds(auth_client, sample_patient):
    """created_at and updated_at should be int ms timestamps, not ISO strings."""
    resp = auth_client.get("/api/v1/sync/pull/", {"last_pulled_at": "0"})
    for table_name in ("patients", "households", "survey_responses"):
        for record in resp.data["changes"][table_name]["created"]:
            assert isinstance(record["created_at"], int), f"{table_name}: created_at should be int"
            assert isinstance(record["updated_at"], int), f"{table_name}: updated_at should be int"
            assert record["created_at"] > 1_700_000_000_000, f"{table_name}: created_at seems wrong"


# ── Pull: deleted records ────────────────────────────────────


@pytest.mark.django_db
def test_pull_deletes_include_sync_event_deletes(auth_client, sample_patient):
    """Deleted patient should appear in pull 'deleted' array via SyncEvent."""
    puid = sample_patient.local_uuid

    # Delete the patient via sync push
    resp = auth_client.post(
        "/api/v1/sync/push/",
        push_payload({
            "patients": {"created": [], "updated": [], "deleted": [str(puid)]}
        }),
        format="json",
    )
    assert resp.status_code == 200

    # Pull should show the patient in deleted
    resp = auth_client.get("/api/v1/sync/pull/", {"last_pulled_at": "0"})
    deleted = resp.data["changes"]["patients"]["deleted"]
    assert str(puid) in deleted, "Deleted patient should appear in pull deleted"


@pytest.mark.django_db
def test_pull_household_deleted_via_is_active(auth_client):
    """Household deactivated via is_active=False should appear in pull deleted."""
    huid = uuid.uuid4()
    auth_client.post(
        "/api/v1/sync/push/",
        push_payload({
            "households": {
                "created": [{"id": str(huid), "household_code": "HH-DEL"}],
                "updated": [], "deleted": [],
            }
        }),
        format="json",
    )

    Household.objects.filter(local_uuid=huid).update(is_active=False)

    resp = auth_client.get("/api/v1/sync/pull/", {"last_pulled_at": "0"})
    deleted = resp.data["changes"]["households"]["deleted"]
    assert str(huid) in deleted, "Deactivated household should appear in pull deleted"


# ── Push & Pull: all model types ──────────────────────────────


@pytest.mark.django_db
def test_push_and_pull_follow_up(auth_client, sample_patient):
    """Push a follow_up, then pull it back with correct field names."""
    fuid = uuid.uuid4()
    puid = sample_patient.local_uuid

    resp = auth_client.post(
        "/api/v1/sync/push/",
        push_payload({
            "follow_ups": {
                "created": [{
                    "id": str(fuid),
                    "patient_id": str(puid),
                    "due_date": "2026-06-01",
                    "urgency": "routine",
                    "notes": "Test follow up",
                }],
                "updated": [], "deleted": [],
            }
        }),
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["results"][0]["status"] == SyncEvent.Status.APPLIED

    from followups.models import FollowUp
    fu = FollowUp.objects.get(local_uuid=fuid)
    assert fu.patient_id == sample_patient.id

    resp = auth_client.get("/api/v1/sync/pull/", {"last_pulled_at": "0"})
    follow_ups = resp.data["changes"]["follow_ups"]["created"]
    matching = [f for f in follow_ups if f["id"] == str(fuid)]
    assert len(matching) == 1
    assert matching[0]["patient_id"] == str(puid)


@pytest.mark.django_db
def test_push_and_pull_referral(auth_client, sample_patient):
    """Push a referral, then pull it back."""
    ruid = uuid.uuid4()
    puid = sample_patient.local_uuid

    resp = auth_client.post(
        "/api/v1/sync/push/",
        push_payload({
            "referrals": {
                "created": [{
                    "id": str(ruid),
                    "patient_id": str(puid),
                    "destination": "PHC Test",
                    "reason": "High risk",
                }],
                "updated": [], "deleted": [],
            }
        }),
        format="json",
    )
    assert resp.status_code == 200

    from referrals.models import Referral
    ref = Referral.objects.get(local_uuid=ruid)
    assert ref.patient_id == sample_patient.id

    resp = auth_client.get("/api/v1/sync/pull/", {"last_pulled_at": "0"})
    referrals = resp.data["changes"]["referrals"]["created"]
    matching = [r for r in referrals if r["id"] == str(ruid)]
    assert len(matching) == 1
    assert matching[0]["provider_name"] == "PHC Test"


@pytest.mark.django_db
def test_push_and_pull_flag(auth_client, sample_patient):
    """Push a flag, then pull it back with WM field names."""
    flag_uid = uuid.uuid4()
    puid = sample_patient.local_uuid

    resp = auth_client.post(
        "/api/v1/sync/push/",
        push_payload({
            "flags": {
                "created": [{
                    "id": str(flag_uid),
                    "patient_id": str(puid),
                    "flag_type": "clinical_risk",
                    "severity": "high",
                    "source": "sync",
                }],
                "updated": [], "deleted": [],
            }
        }),
        format="json",
    )
    assert resp.status_code == 200

    resp = auth_client.get("/api/v1/sync/pull/", {"last_pulled_at": "0"})
    flags = resp.data["changes"]["flags"]["created"]
    matching = [f for f in flags if f["id"] == str(flag_uid)]
    assert len(matching) == 1
    assert matching[0]["patient_id"] == str(puid)
    assert matching[0]["flag_type"] == "clinical_risk"


@pytest.mark.django_db
def test_push_incentive_then_pull(auth_client):
    """Push an incentive record, pull it back."""
    iuid = uuid.uuid4()

    resp = auth_client.post(
        "/api/v1/sync/push/",
        push_payload({
            "incentive_records": {
                "created": [{
                    "id": str(iuid),
                    "action_type": "survey_completion",
                    "points": 10,
                    "period_date": "2026-05",
                }],
                "updated": [], "deleted": [],
            }
        }),
        format="json",
    )
    assert resp.status_code == 200

    from incentives.models import IncentiveLedgerEntry
    entry = IncentiveLedgerEntry.objects.get(local_uuid=iuid)
    assert entry.activity_type == "survey_completion"

    resp = auth_client.get("/api/v1/sync/pull/", {"last_pulled_at": "0"})
    incentives = resp.data["changes"]["incentive_records"]["created"]
    matching = [i for i in incentives if i["id"] == str(iuid)]
    assert len(matching) == 1
    assert matching[0]["action_type"] == "survey_completion"
