import uuid

import pytest
from django.test import override_settings
from followups.models import FollowUp

from tests.factories import HouseholdFactory, PatientFactory, UserFactory

from .test_sync import push_payload


@pytest.fixture
def household_with_gps():
    return HouseholdFactory(lat=28.6139, lng=77.2090)


@pytest.fixture
def patient_with_gps_household(household_with_gps, worker):
    return PatientFactory(household=household_with_gps, asha_worker=worker)


def _follow_up_created(fuid=None, patient_uuid=None, **extra):
    record = {
        "id": str(fuid or uuid.uuid4()),
        "patient_id": str(patient_uuid or uuid.uuid4()),
        "due_date": "2026-07-01",
        "urgency": "routine",
        "notes": "Test sync follow up",
    }
    record.update(extra)
    return {"created": [record], "updated": [], "deleted": []}


@pytest.mark.django_db
def test_sync_push_follow_up_creates(worker_client, patient_with_gps_household):
    fuid = uuid.uuid4()
    puid = patient_with_gps_household.local_uuid
    resp = worker_client.post(
        "/api/v1/sync/push/",
        push_payload({"follow_ups": _follow_up_created(fuid, puid)}),
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["results"][0]["status"] == "applied"
    assert FollowUp.objects.filter(local_uuid=fuid).exists()


@pytest.mark.django_db
def test_sync_push_follow_up_sets_gps_within_radius(worker_client, patient_with_gps_household):
    fuid = uuid.uuid4()
    puid = patient_with_gps_household.local_uuid
    # GPS at almost same location as household (28.6139, 77.2090) → ~0m
    resp = worker_client.post(
        "/api/v1/sync/push/",
        push_payload(
            {
                "follow_ups": _follow_up_created(
                    fuid,
                    puid,
                    visit_lat=28.6139,
                    visit_lng=77.2090,
                    visit_accuracy_m=10.0,
                    visit_gps_timestamp="2026-07-01T10:00:00+00:00",
                )
            }
        ),
        format="json",
    )
    assert resp.status_code == 200
    fu = FollowUp.objects.get(local_uuid=fuid)
    assert fu.distance_from_household_m is not None
    assert fu.distance_from_household_m < 10
    assert fu.gps_verification_status == FollowUp.GpsStatus.WITHIN_RADIUS
    assert fu.visit_lat == 28.6139
    assert fu.visit_lng == 77.2090


@pytest.mark.django_db
def test_sync_push_follow_up_gps_outside_radius(worker_client, patient_with_gps_household):
    fuid = uuid.uuid4()
    puid = patient_with_gps_household.local_uuid
    # GPS far away (~111km away)
    resp = worker_client.post(
        "/api/v1/sync/push/",
        push_payload(
            {
                "follow_ups": _follow_up_created(
                    fuid,
                    puid,
                    visit_lat=28.6139,
                    visit_lng=78.2090,
                    visit_accuracy_m=10.0,
                )
            }
        ),
        format="json",
    )
    assert resp.status_code == 200
    fu = FollowUp.objects.get(local_uuid=fuid)
    assert fu.gps_verification_status == FollowUp.GpsStatus.OUTSIDE_RADIUS


@pytest.mark.django_db
@override_settings(GPS_ACCEPTABLE_RADIUS_M=200, GPS_WARNING_RADIUS_M=500)
def test_sync_push_follow_up_gps_warning_zone(worker_client, patient_with_gps_household):
    fuid = uuid.uuid4()
    puid = patient_with_gps_household.local_uuid
    # GPS ~300m away from household
    resp = worker_client.post(
        "/api/v1/sync/push/",
        push_payload(
            {
                "follow_ups": _follow_up_created(fuid, puid, visit_lat=28.6139, visit_lng=77.2130, visit_accuracy_m=10.0)
            }
        ),
        format="json",
    )
    assert resp.status_code == 200
    fu = FollowUp.objects.get(local_uuid=fuid)
    assert fu.gps_verification_status == FollowUp.GpsStatus.WARNING_ZONE


@pytest.mark.django_db
def test_sync_push_follow_up_no_gps_sets_not_captured(worker_client, patient_with_gps_household):
    fuid = uuid.uuid4()
    puid = patient_with_gps_household.local_uuid
    resp = worker_client.post(
        "/api/v1/sync/push/",
        push_payload({"follow_ups": _follow_up_created(fuid, puid)}),
        format="json",
    )
    assert resp.status_code == 200
    fu = FollowUp.objects.get(local_uuid=fuid)
    assert fu.gps_verification_status == FollowUp.GpsStatus.NOT_CAPTURED
    assert fu.distance_from_household_m is None


@pytest.mark.django_db
def test_sync_push_follow_up_no_household_gps(worker_client):
    household = HouseholdFactory(lat=None, lng=None)
    patient = PatientFactory(household=household, asha_worker=worker_client.handler._force_user)
    fuid = uuid.uuid4()
    puid = patient.local_uuid
    resp = worker_client.post(
        "/api/v1/sync/push/",
        push_payload(
            {
                "follow_ups": _follow_up_created(fuid, puid, visit_lat=28.6139, visit_lng=77.2090, visit_accuracy_m=10.0)
            }
        ),
        format="json",
    )
    assert resp.status_code == 200
    fu = FollowUp.objects.get(local_uuid=fuid)
    assert fu.gps_verification_status == FollowUp.GpsStatus.NO_HOUSEHOLD_GPS


@pytest.mark.django_db
def test_sync_push_follow_up_permission_denied(patient_with_gps_household):
    from rest_framework.test import APIClient

    other = UserFactory(village="OtherVillage")
    client = APIClient()
    client.force_authenticate(other)
    fuid = uuid.uuid4()
    puid = patient_with_gps_household.local_uuid
    resp = client.post(
        "/api/v1/sync/push/",
        push_payload({"follow_ups": _follow_up_created(fuid, puid)}),
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["results"][0]["status"] == "error"
    assert "access" in resp.data["results"][0].get("message", "").lower()
