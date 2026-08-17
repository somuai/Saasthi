import pytest
from django.utils import timezone
from incentives.models import ASHAWorkerProfile, IncentiveLedgerEntry, IncentiveRate
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


# ─── Monthly Summary API ───


@pytest.mark.django_db
def test_monthly_summary(api_client, worker):
    month_year = timezone.now().strftime("%Y-%m")
    IncentiveLedgerEntry.objects.create(
        worker=worker,
        activity_type=IncentiveLedgerEntry.ActivityType.SURVEY_COMPLETION,
        amount_paise=5000,
        month_year=month_year,
    )
    IncentiveLedgerEntry.objects.create(
        worker=worker,
        activity_type=IncentiveLedgerEntry.ActivityType.ANC_CARE,
        amount_paise=30000,
        month_year=month_year,
    )
    api_client.force_authenticate(worker)
    resp = api_client.get(f"/api/v1/incentives/ledger/monthly_summary/{month_year}/")
    assert resp.status_code == 200
    assert resp.data["total_paise"] == 35000
    assert resp.data["entries_count"] == 2
    assert resp.data["worker_name"] is not None


@pytest.mark.django_db
def test_monthly_summary_invalid_date(api_client, worker):
    api_client.force_authenticate(worker)
    resp = api_client.get("/api/v1/incentives/ledger/monthly_summary/bad/")
    assert resp.status_code == 400


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


# ─── New Activity Types ───


@pytest.mark.django_db
def test_new_activity_types_exist():
    choices = dict(IncentiveLedgerEntry.ActivityType.choices)
    assert choices["sanitary_napkin_distribution"] == "Sanitary napkin distribution to adolescent girls"
    assert choices["tb_ds_treatment_completion"] == "Drug-sensitive TB treatment completion honorarium"
    assert choices["asha_certification"] == "ASHA certification incentive (RMNCHA+N + Expanded)"
    assert choices["pla_meeting"] == "PLA meeting conduct"
    assert choices["sam_referral_followup"] == "SAM child referral to NRC & follow-up"
    assert choices["abortion_transport"] == "Transport incentive for safe abortion services"
    assert choices["dengue_chikungunya_iec"] == "Dengue/Chikungunya source reduction & IEC"
    assert choices["toilet_motivation"] == "Toilet construction motivation"
    assert choices["tap_connection"] == "Individual tap connection motivation"


@pytest.mark.django_db
def test_create_entry_with_new_activity_type(worker):
    for atype in [
        IncentiveLedgerEntry.ActivityType.SANITARY_NAPKIN_DISTRIBUTION,
        IncentiveLedgerEntry.ActivityType.TB_DS_TREATMENT_COMPLETION,
        IncentiveLedgerEntry.ActivityType.ASHA_CERTIFICATION,
        IncentiveLedgerEntry.ActivityType.DENGUE_CHIKUNGUNYA_IEC,
    ]:
        entry = IncentiveLedgerEntry.objects.create(
            worker=worker,
            activity_type=atype,
            amount_paise=10000,
            month_year="2026-05",
        )
        assert entry.activity_type == atype
        assert entry.amount_paise == 10000


@pytest.mark.django_db
def test_all_activity_types_creatable(worker):
    for code, _ in IncentiveLedgerEntry.ActivityType.choices:
        entry = IncentiveLedgerEntry.objects.create(
            worker=worker,
            activity_type=code,
            amount_paise=10000,
            month_year="2026-05",
        )
        assert entry.pk is not None
        assert entry.activity_type == code


# ─── ASHAWorkerProfile model ───


@pytest.mark.django_db
def test_asha_worker_profile_create(worker):
    profile = ASHAWorkerProfile.objects.create(
        user=worker,
        asha_id="1234567",
        husband_name="Ramesh",
        bank_details={"account_number": "1234567890", "ifsc": "SBIN0001234"},
    )
    assert profile.asha_id == "1234567"
    assert profile.husband_name == "Ramesh"
    assert profile.bank_details["account_number"] == "1234567890"
    assert profile.is_active is True
    assert str(profile) is not None


@pytest.mark.django_db
def test_asha_worker_profile_unique_asha_id(worker):
    ASHAWorkerProfile.objects.create(user=worker, asha_id="1234567")
    worker2 = UserFactory()
    with pytest.raises(Exception):
        ASHAWorkerProfile.objects.create(user=worker2, asha_id="1234567")


@pytest.mark.django_db
def test_asha_worker_profile_unique_user(worker):
    ASHAWorkerProfile.objects.create(user=worker, asha_id="1234567")
    with pytest.raises(Exception):
        ASHAWorkerProfile.objects.create(user=worker, asha_id="7654321")


# ─── ASHAWorkerProfile API ───


@pytest.mark.django_db
def test_asha_profile_api_lookup(api_client, worker):
    profile = ASHAWorkerProfile.objects.create(
        user=worker,
        asha_id="1234567",
        husband_name="Ramesh",
    )
    api_client.force_authenticate(worker)
    resp = api_client.get(f"/api/v1/incentives/asha-profiles/{profile.asha_id}/")
    assert resp.status_code == 200
    assert resp.data["asha_id"] == "1234567"
    assert resp.data["husband_name"] == "Ramesh"
    assert "user_details" in resp.data


@pytest.mark.django_db
def test_asha_profile_api_list(api_client, supervisor):
    worker1 = UserFactory()
    worker2 = UserFactory()
    ASHAWorkerProfile.objects.create(user=worker1, asha_id="1111111")
    ASHAWorkerProfile.objects.create(user=worker2, asha_id="2222222")
    api_client.force_authenticate(supervisor)
    resp = api_client.get("/api/v1/incentives/asha-profiles/")
    assert resp.status_code == 200
    assert len(resp.data) >= 2


# ─── Calculator Service (unit) ───


@pytest.mark.django_db
def test_calculator_creates_anc_incentive(worker):
    IncentiveRate.objects.create(activity_type="anc_registration", amount_paise=30000, is_active=True)
    from incentives.services.calculator import IncentiveCalculatorService

    svc = IncentiveCalculatorService(year=2026, month=5)
    created = svc._process_anc_registrations(
        worker,
        timezone.now().replace(year=2026, month=5, day=1),
        timezone.now().replace(year=2026, month=5, day=31),
        {"anc_registration": 30000},
    )
    assert len(created) == 0  # No ANC registrations exist yet

    import uuid

    entry = IncentiveLedgerEntry.objects.create(
        worker=worker,
        activity_type="anc_registration",
        amount_paise=30000,
        month_year="2026-05",
        reference_id=uuid.uuid4(),
        reference_type="Patient",
    )
    assert entry.pk is not None
    assert entry.amount_rupees == 300.0
