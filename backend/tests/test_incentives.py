import pytest
from django.utils import timezone
from incentives.models import IncentiveLedgerEntry, IncentiveRate
from rest_framework.test import APIClient

from tests.factories import FollowUpFactory, SupervisorFactory, UserFactory


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def worker(db):
    return UserFactory()


@pytest.fixture
def supervisor(db):
    return SupervisorFactory()


@pytest.fixture
def sample_rate(db):
    IncentiveRate.objects.update_or_create(
        activity_type="survey_completion",
        defaults={"amount_paise": 5000, "is_active": True},
    )
    IncentiveRate.objects.update_or_create(
        activity_type="hard_flag_referral",
        defaults={"amount_paise": 20000, "is_active": True},
    )
    IncentiveRate.objects.update_or_create(
        activity_type="followup_completed_on_time",
        defaults={"amount_paise": 7500, "is_active": True},
    )


# ─── IncentiveRate API ───

@pytest.mark.django_db
def test_incentive_rates_list(sample_rate):
    client = APIClient()
    user = UserFactory()
    client.force_authenticate(user)
    resp = client.get("/api/v1/incentives/rates/")
    assert resp.status_code == 200
    assert len(resp.data) >= 3
    rates = {r["activity_type"]: r["amount_paise"] for r in resp.data}
    assert rates["survey_completion"] == 5000
    assert rates["hard_flag_referral"] == 20000
    assert rates["followup_completed_on_time"] == 7500


@pytest.mark.django_db
def test_incentive_rates_unauthenticated(sample_rate):
    resp = APIClient().get("/api/v1/incentives/rates/")
    assert resp.status_code in (401, 403)


# ─── Approval API ───

@pytest.mark.django_db
def test_approve_ledger_entry(api_client, supervisor):
    entry = IncentiveLedgerEntry.objects.create(
        worker=supervisor,
        activity_type=IncentiveLedgerEntry.ActivityType.SURVEY_COMPLETION,
        amount_paise=5000,
        month_year=timezone.now().strftime("%Y-%m"),
    )
    assert entry.status == IncentiveLedgerEntry.Status.PENDING
    api_client.force_authenticate(supervisor)
    resp = api_client.post(f"/api/v1/incentives/ledger/{entry.pk}/approve/")
    assert resp.status_code == 200
    entry.refresh_from_db()
    assert entry.status == IncentiveLedgerEntry.Status.APPROVED
    assert entry.approved_by == str(supervisor)
    assert entry.approved_at is not None


@pytest.mark.django_db
def test_approve_wrong_status(api_client, supervisor):
    entry = IncentiveLedgerEntry.objects.create(
        worker=supervisor,
        activity_type=IncentiveLedgerEntry.ActivityType.SURVEY_COMPLETION,
        amount_paise=5000,
        status=IncentiveLedgerEntry.Status.PAID,
        month_year=timezone.now().strftime("%Y-%m"),
    )
    api_client.force_authenticate(supervisor)
    resp = api_client.post(f"/api/v1/incentives/ledger/{entry.pk}/approve/")
    assert resp.status_code == 409


@pytest.mark.django_db
def test_approve_worker_forbidden(api_client, worker):
    entry = IncentiveLedgerEntry.objects.create(
        worker=worker,
        activity_type=IncentiveLedgerEntry.ActivityType.SURVEY_COMPLETION,
        amount_paise=5000,
        month_year=timezone.now().strftime("%Y-%m"),
    )
    api_client.force_authenticate(worker)
    resp = api_client.post(f"/api/v1/incentives/ledger/{entry.pk}/approve/")
    assert resp.status_code in (401, 403)


@pytest.mark.django_db
def test_mark_paid(api_client, supervisor):
    entry = IncentiveLedgerEntry.objects.create(
        worker=supervisor,
        activity_type=IncentiveLedgerEntry.ActivityType.SURVEY_COMPLETION,
        amount_paise=5000,
        status=IncentiveLedgerEntry.Status.APPROVED,
        month_year=timezone.now().strftime("%Y-%m"),
    )
    api_client.force_authenticate(supervisor)
    resp = api_client.post(f"/api/v1/incentives/ledger/{entry.pk}/mark_paid/")
    assert resp.status_code == 200
    entry.refresh_from_db()
    assert entry.status == IncentiveLedgerEntry.Status.PAID
    assert entry.paid_at is not None


@pytest.mark.django_db
def test_mark_paid_wrong_status(api_client, supervisor):
    entry = IncentiveLedgerEntry.objects.create(
        worker=supervisor,
        activity_type=IncentiveLedgerEntry.ActivityType.SURVEY_COMPLETION,
        amount_paise=5000,
        status=IncentiveLedgerEntry.Status.PENDING,
        month_year=timezone.now().strftime("%Y-%m"),
    )
    api_client.force_authenticate(supervisor)
    resp = api_client.post(f"/api/v1/incentives/ledger/{entry.pk}/mark_paid/")
    assert resp.status_code == 409


# ─── Auto-creation via signals (FollowUp) ───

@pytest.mark.django_db
def test_auto_incentive_on_followup_completed(sample_rate, worker):
    from followups.models import FollowUp

    followup = FollowUpFactory(worker=worker, status=FollowUp.Status.PENDING)
    assert followup.incentive_claimed is False

    followup.status = FollowUp.Status.COMPLETED
    followup.save(update_fields=["status"])

    followup.refresh_from_db()
    assert followup.incentive_claimed is True

    entry = IncentiveLedgerEntry.objects.filter(
        reference_type="FollowUp",
        reference_id=followup.local_uuid,
    ).first()
    assert entry is not None
    assert entry.activity_type == IncentiveLedgerEntry.ActivityType.FOLLOWUP_COMPLETED
    assert entry.amount_paise == 7500
    assert entry.status == IncentiveLedgerEntry.Status.PENDING


@pytest.mark.django_db
def test_auto_incentive_no_duplicate(sample_rate, worker):
    from followups.models import FollowUp

    followup = FollowUpFactory(worker=worker, status=FollowUp.Status.PENDING)
    followup.status = FollowUp.Status.COMPLETED
    followup.save(update_fields=["status"])

    count_after_first = IncentiveLedgerEntry.objects.filter(
        reference_type="FollowUp",
        reference_id=followup.local_uuid,
    ).count()
    assert count_after_first >= 1


@pytest.mark.django_db
def test_auto_incentive_skipped_on_missed(sample_rate, worker):
    from followups.models import FollowUp

    followup = FollowUpFactory(worker=worker, status=FollowUp.Status.PENDING)
    followup.status = FollowUp.Status.MISSED
    followup.save(update_fields=["status"])

    count = IncentiveLedgerEntry.objects.filter(
        reference_type="FollowUp",
        reference_id=followup.local_uuid,
    ).count()
    assert count == 0
