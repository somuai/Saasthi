
import pytest
from django.test import override_settings
from django.utils import timezone
from followups.models import FollowUp, VisitRecord

from tests.factories import HouseholdFactory, PatientFactory


@pytest.mark.django_db
def test_visit_record_gps_within_radius(worker_client, worker):
    household = HouseholdFactory(lat=28.6139, lng=77.2090)
    patient = PatientFactory(household=household, asha_worker=worker)
    payload = {
        "patient": patient.id,
        "worker": worker.id,
        "visit_date": timezone.now().date().isoformat(),
        "condition_observed": VisitRecord.Condition.GOOD,
        "visit_lat": 28.6139,
        "visit_lng": 77.2090,
        "visit_accuracy_m": 10.0,
    }
    resp = worker_client.post("/api/v1/visits/", payload, format="json")
    assert resp.status_code == 201
    vr = VisitRecord.objects.get(pk=resp.data["id"])
    assert vr.distance_from_household_m < 10
    assert vr.gps_verification_status == FollowUp.GpsStatus.WITHIN_RADIUS


@pytest.mark.django_db
def test_visit_record_gps_outside_radius(worker_client, worker):
    household = HouseholdFactory(lat=28.6139, lng=77.2090)
    patient = PatientFactory(household=household, asha_worker=worker)
    payload = {
        "patient": patient.id,
        "worker": worker.id,
        "visit_date": timezone.now().date().isoformat(),
        "condition_observed": VisitRecord.Condition.GOOD,
        "visit_lat": 28.6139,
        "visit_lng": 78.2090,
        "visit_accuracy_m": 10.0,
    }
    resp = worker_client.post("/api/v1/visits/", payload, format="json")
    assert resp.status_code == 201
    vr = VisitRecord.objects.get(pk=resp.data["id"])
    assert vr.gps_verification_status == FollowUp.GpsStatus.OUTSIDE_RADIUS


@pytest.mark.django_db
@override_settings(GPS_ACCEPTABLE_RADIUS_M=200, GPS_WARNING_RADIUS_M=500)
def test_visit_record_gps_warning_zone(worker_client, worker):
    household = HouseholdFactory(lat=28.6139, lng=77.2090)
    patient = PatientFactory(household=household, asha_worker=worker)
    # ~300m away
    payload = {
        "patient": patient.id,
        "worker": worker.id,
        "visit_date": timezone.now().date().isoformat(),
        "condition_observed": VisitRecord.Condition.GOOD,
        "visit_lat": 28.6139,
        "visit_lng": 77.2130,
        "visit_accuracy_m": 10.0,
    }
    resp = worker_client.post("/api/v1/visits/", payload, format="json")
    assert resp.status_code == 201
    vr = VisitRecord.objects.get(pk=resp.data["id"])
    assert vr.gps_verification_status == FollowUp.GpsStatus.WARNING_ZONE


@pytest.mark.django_db
def test_visit_record_gps_no_household_gps(worker_client, worker):
    household = HouseholdFactory(lat=None, lng=None)
    patient = PatientFactory(household=household, asha_worker=worker)
    payload = {
        "patient": patient.id,
        "worker": worker.id,
        "visit_date": timezone.now().date().isoformat(),
        "condition_observed": VisitRecord.Condition.GOOD,
        "visit_lat": 28.6139,
        "visit_lng": 77.2090,
        "visit_accuracy_m": 10.0,
    }
    resp = worker_client.post("/api/v1/visits/", payload, format="json")
    assert resp.status_code == 201
    vr = VisitRecord.objects.get(pk=resp.data["id"])
    assert vr.gps_verification_status == FollowUp.GpsStatus.NO_HOUSEHOLD_GPS


@pytest.mark.django_db
def test_visit_record_gps_no_gps_not_captured(worker_client, worker):
    household = HouseholdFactory(lat=28.6139, lng=77.2090)
    patient = PatientFactory(household=household, asha_worker=worker)
    payload = {
        "patient": patient.id,
        "worker": worker.id,
        "visit_date": timezone.now().date().isoformat(),
        "condition_observed": VisitRecord.Condition.GOOD,
    }
    resp = worker_client.post("/api/v1/visits/", payload, format="json")
    assert resp.status_code == 201
    vr = VisitRecord.objects.get(pk=resp.data["id"])
    assert vr.gps_verification_status == FollowUp.GpsStatus.NOT_CAPTURED
    assert vr.distance_from_household_m is None
