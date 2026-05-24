from datetime import date, time

import pytest
from django.utils import timezone

from followups.models import FollowUp, VisitRecord


class TestFollowUp:
    @pytest.mark.django_db
    def test_defaults(self, followup):
        assert followup.status == FollowUp.Status.PENDING
        assert followup.urgency == FollowUp.Urgency.ROUTINE
        assert followup.is_auto_scheduled is False
        assert followup.incentive_claimed is False
        assert followup.completion_notes == ""

    @pytest.mark.django_db
    def test_str(self, followup):
        expected = f"FollowUp {followup.patient.pk} on {followup.scheduled_date} (pending)"
        assert str(followup) == expected

    @pytest.mark.django_db
    def test_can_be_completed(self, followup):
        followup.status = FollowUp.Status.COMPLETED
        followup.completed_at = timezone.now()
        followup.completion_notes = "Patient visited and counseled"
        followup.save()
        followup.refresh_from_db()
        assert followup.status == FollowUp.Status.COMPLETED
        assert followup.completed_at is not None
        assert followup.completion_notes == "Patient visited and counseled"

    @pytest.mark.django_db
    def test_urgency_choices(self, followup):
        followup.urgency = FollowUp.Urgency.WITHIN_24H
        followup.save()
        followup.refresh_from_db()
        assert followup.urgency == FollowUp.Urgency.WITHIN_24H
        assert followup.get_urgency_display() == "Within 24 hours"

    @pytest.mark.django_db
    def test_cascade_on_patient_delete(self, followup):
        followup.patient.delete()
        followup.refresh_from_db()
        assert followup.patient is None


class TestVisitRecord:
    @pytest.mark.django_db
    def test_defaults(self, patient, worker):
        visit = VisitRecord.objects.create(patient=patient, worker=worker, visit_date=date.today())
        assert visit.condition_observed == VisitRecord.Condition.GOOD
        assert visit.referred_to_phc is False
        assert visit.notes == ""
        assert visit.referral_facility == ""
        assert visit.follow_up is None

    @pytest.mark.django_db
    def test_str(self, patient, worker):
        visit = VisitRecord.objects.create(patient=patient, worker=worker, visit_date=date(2025, 7, 20))
        expected = f"Visit {patient.pk} on 2025-07-20"
        assert str(visit) == expected

    @pytest.mark.django_db
    def test_with_followup(self, patient, worker, followup):
        visit = VisitRecord.objects.create(
            patient=patient,
            worker=worker,
            follow_up=followup,
            visit_date=date.today(),
            condition_observed=VisitRecord.Condition.FAIR,
            referred_to_phc=True,
            next_visit_date=date(2025, 8, 1),
        )
        assert visit.follow_up == followup
        assert visit.condition_observed == VisitRecord.Condition.FAIR
        assert visit.referred_to_phc is True

    @pytest.mark.django_db
    def test_with_time_and_notes(self, patient, worker):
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
    def test_ordering(self, patient, worker):
        v1 = VisitRecord.objects.create(patient=patient, worker=worker, visit_date=date(2025, 1, 1))
        v2 = VisitRecord.objects.create(patient=patient, worker=worker, visit_date=date(2025, 6, 1))
        v3 = VisitRecord.objects.create(patient=patient, worker=worker, visit_date=date(2025, 3, 1))
        visits = list(VisitRecord.objects.all())
        assert visits == [v2, v3, v1]
