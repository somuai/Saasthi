from datetime import date, time

import pytest
from django.utils import timezone

from accounts.models import User
from followups.models import FollowUp, VisitRecord
from registry.models import Patient


# ── FollowUp ──────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_followup_defaults():
    patient = Patient.objects.create(full_name="Test Patient", gender="female", village="Central")
    worker = User.objects.create_user(username="worker", phone="+15550000001", role=User.Role.HEALTH_WORKER)
    fup = FollowUp.objects.create(
        patient=patient,
        worker=worker,
        scheduled_date=date.today(),
    )
    assert fup.status == FollowUp.Status.PENDING
    assert fup.urgency == FollowUp.Urgency.ROUTINE
    assert fup.is_auto_scheduled is False
    assert fup.incentive_claimed is False
    assert fup.completion_notes == ""


@pytest.mark.django_db
def test_followup_str():
    patient = Patient.objects.create(full_name="Test Patient", gender="female", village="Central")
    worker = User.objects.create_user(username="worker", phone="+15550000001", role=User.Role.HEALTH_WORKER)
    fup = FollowUp.objects.create(
        patient=patient,
        worker=worker,
        scheduled_date=date(2025, 6, 15),
    )
    expected = f"FollowUp {patient.pk} on 2025-06-15 (pending)"
    assert str(fup) == expected


@pytest.mark.django_db
def test_followup_can_be_completed():
    patient = Patient.objects.create(full_name="Test Patient", gender="female", village="Central")
    worker = User.objects.create_user(username="worker", phone="+15550000001", role=User.Role.HEALTH_WORKER)
    fup = FollowUp.objects.create(
        patient=patient,
        worker=worker,
        scheduled_date=date.today(),
    )
    fup.status = FollowUp.Status.COMPLETED
    fup.completed_at = timezone.now()
    fup.completion_notes = "Patient visited and counseled"
    fup.save()

    fup.refresh_from_db()
    assert fup.status == FollowUp.Status.COMPLETED
    assert fup.completed_at is not None
    assert fup.completion_notes == "Patient visited and counseled"


@pytest.mark.django_db
def test_followup_urgency_choices():
    patient = Patient.objects.create(full_name="Test Patient", gender="female", village="Central")
    worker = User.objects.create_user(username="worker", phone="+15550000001", role=User.Role.HEALTH_WORKER)
    fup = FollowUp.objects.create(
        patient=patient,
        worker=worker,
        scheduled_date=date.today(),
        urgency=FollowUp.Urgency.WITHIN_24H,
    )
    assert fup.urgency == FollowUp.Urgency.WITHIN_24H
    assert fup.get_urgency_display() == "Within 24 hours"


@pytest.mark.django_db
def test_followup_cascade_on_patient_delete():
    patient = Patient.objects.create(full_name="Test Patient", gender="female", village="Central")
    worker = User.objects.create_user(username="worker", phone="+15550000001", role=User.Role.HEALTH_WORKER)
    FollowUp.objects.create(
        patient=patient,
        worker=worker,
        scheduled_date=date.today(),
    )
    patient.delete()
    assert FollowUp.objects.count() == 0


# ── VisitRecord ───────────────────────────────────────────────────────


@pytest.mark.django_db
def test_visitrecord_defaults():
    patient = Patient.objects.create(full_name="Test Patient", gender="female", village="Central")
    worker = User.objects.create_user(username="worker", phone="+15550000001", role=User.Role.HEALTH_WORKER)
    visit = VisitRecord.objects.create(
        patient=patient,
        worker=worker,
        visit_date=date.today(),
    )
    assert visit.condition_observed == VisitRecord.Condition.GOOD
    assert visit.referred_to_phc is False
    assert visit.notes == ""
    assert visit.referral_facility == ""
    assert visit.follow_up is None


@pytest.mark.django_db
def test_visitrecord_str():
    patient = Patient.objects.create(full_name="Test Patient", gender="female", village="Central")
    worker = User.objects.create_user(username="worker", phone="+15550000001", role=User.Role.HEALTH_WORKER)
    visit = VisitRecord.objects.create(
        patient=patient,
        worker=worker,
        visit_date=date(2025, 7, 20),
    )
    expected = f"Visit {patient.pk} on 2025-07-20"
    assert str(visit) == expected


@pytest.mark.django_db
def test_visitrecord_with_followup():
    patient = Patient.objects.create(full_name="Test Patient", gender="female", village="Central")
    worker = User.objects.create_user(username="worker", phone="+15550000001", role=User.Role.HEALTH_WORKER)
    fup = FollowUp.objects.create(
        patient=patient,
        worker=worker,
        scheduled_date=date.today(),
    )
    visit = VisitRecord.objects.create(
        patient=patient,
        worker=worker,
        follow_up=fup,
        visit_date=date.today(),
        condition_observed=VisitRecord.Condition.FAIR,
        referred_to_phc=True,
        next_visit_date=date(2025, 8, 1),
    )
    assert visit.follow_up == fup
    assert visit.condition_observed == VisitRecord.Condition.FAIR
    assert visit.referred_to_phc is True


@pytest.mark.django_db
def test_visitrecord_with_time_and_notes():
    patient = Patient.objects.create(full_name="Test Patient", gender="female", village="Central")
    worker = User.objects.create_user(username="worker", phone="+15550000001", role=User.Role.HEALTH_WORKER)
    visit = VisitRecord.objects.create(
        patient=patient,
        worker=worker,
        visit_date=date.today(),
        visit_time=time(10, 30),
        notes="Patient is recovering well",
        condition_observed=VisitRecord.Condition.POOR,
    )
    assert visit.visit_time == time(10, 30)
    assert visit.notes == "Patient is recovering well"
    assert visit.condition_observed == VisitRecord.Condition.POOR


@pytest.mark.django_db
def test_visitrecord_ordering():
    patient = Patient.objects.create(full_name="Test Patient", gender="female", village="Central")
    worker = User.objects.create_user(username="worker", phone="+15550000001", role=User.Role.HEALTH_WORKER)
    v1 = VisitRecord.objects.create(patient=patient, worker=worker, visit_date=date(2025, 1, 1))
    v2 = VisitRecord.objects.create(patient=patient, worker=worker, visit_date=date(2025, 6, 1))
    v3 = VisitRecord.objects.create(patient=patient, worker=worker, visit_date=date(2025, 3, 1))
    visits = list(VisitRecord.objects.all())
    assert visits == [v2, v3, v1]
