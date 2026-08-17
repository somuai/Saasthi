import pytest
from accounts.models import User
from flagging.models import Flag
from incentives.models import IncentiveLedgerEntry
from referrals.models import Referral
from registry.models import Patient

from tests.factories import (
    AdminUserFactory,
    BlockManagerFactory,
    DistrictOfficerFactory,
    PatientFactory,
    StateAdminFactory,
    SupervisorFactory,
    UserFactory,
    WorkerRegistrationFactory,
)


@pytest.mark.django_db
class TestDashboardSummary:
    def test_summary_returns_kpis(self, api_client):
        user = AdminUserFactory()
        PatientFactory(status="active", pregnancy_status=True, is_high_risk_pregnancy=False)
        PatientFactory(status="active", pregnancy_status=True, is_high_risk_pregnancy=True)
        api_client.force_authenticate(user=user)
        resp = api_client.get("/dashboard/api/summary/")
        assert resp.status_code == 200
        data = resp.data
        assert data["total_patients"] >= 2
        assert data["active_patients"] >= 2
        assert data["pregnant"] >= 2
        assert data["high_risk"] >= 1
        assert "total_ashas" in data
        assert "open_flags" in data
        assert "flags_by_severity" in data
        assert "referrals_by_status" in data

    def test_summary_supervisor_scoped(self, api_client):
        sup = SupervisorFactory(village="", district="", block="BlockA")
        SupervisorFactory(village="", district="", block="BlockB")
        PatientFactory(village="", district="", block="BlockA")
        PatientFactory(village="", district="", block="BlockB")
        api_client.force_authenticate(user=sup)
        resp = api_client.get("/dashboard/api/summary/")
        assert resp.data["total_patients"] == 1


@pytest.mark.django_db
class TestDashboardRolePermissions:
    """The sidebar exposes dashboard pages to the administrative roles; the
    backend IsANMOrAdmin permission must honour the same set."""

    @pytest.mark.parametrize(
        "factory",
        [
            AdminUserFactory,
            StateAdminFactory,
            DistrictOfficerFactory,
            BlockManagerFactory,
            SupervisorFactory,
        ],
    )
    def test_admin_roles_can_access_summary(self, api_client, factory):
        api_client.force_authenticate(user=factory())
        resp = api_client.get("/dashboard/api/summary/")
        assert resp.status_code == 200

    def test_health_worker_is_forbidden(self, api_client):
        api_client.force_authenticate(user=UserFactory(role=User.Role.HEALTH_WORKER))
        resp = api_client.get("/dashboard/api/summary/")
        assert resp.status_code == 403


@pytest.mark.django_db
class TestRecentActivity:
    def test_supervisor_does_not_crash(self, api_client):
        """Regression: filtering after a slice raised
        "Cannot filter a query once a slice has been taken"."""
        sup = SupervisorFactory(village="", district="", block="")
        asha = UserFactory(role=User.Role.HEALTH_WORKER)
        WorkerRegistrationFactory(phone=asha.phone, supervisor=sup, is_active=True)
        PatientFactory(asha_worker=asha)
        api_client.force_authenticate(user=sup)
        resp = api_client.get("/dashboard/api/activity/")
        assert resp.status_code == 200
        assert isinstance(resp.data, list)

    def test_returns_patient_and_asha_events(self, api_client):
        user = AdminUserFactory()
        PatientFactory()
        UserFactory(role=User.Role.HEALTH_WORKER)
        api_client.force_authenticate(user=user)
        resp = api_client.get("/dashboard/api/activity/")
        assert resp.status_code == 200
        types = {e["type"] for e in resp.data}
        assert "patient_created" in types
        assert "asha_onboarded" in types

    def test_supervisor_scoped_to_registered_workers(self, api_client):
        sup = SupervisorFactory(village="", district="", block="")
        asha = UserFactory(role=User.Role.HEALTH_WORKER)
        UserFactory(role=User.Role.HEALTH_WORKER)  # not registered to this supervisor
        WorkerRegistrationFactory(phone=asha.phone, supervisor=sup, is_active=True)
        api_client.force_authenticate(user=sup)
        resp = api_client.get("/dashboard/api/activity/")
        assert resp.status_code == 200
        assert len([e for e in resp.data if e["type"] == "asha_onboarded"]) == 1



@pytest.mark.django_db
class TestDashboardPatients:
    def test_list_patients(self, api_client):
        user = AdminUserFactory()
        PatientFactory()
        PatientFactory()
        api_client.force_authenticate(user=user)
        resp = api_client.get("/dashboard/api/patients/")
        assert resp.status_code == 200
        assert len(resp.data) >= 2

    def test_search_patients(self, api_client):
        user = AdminUserFactory()
        PatientFactory(full_name="Riya Sharma")
        PatientFactory(full_name="Anita Devi")
        api_client.force_authenticate(user=user)
        resp = api_client.get("/dashboard/api/patients/?search=riya")
        assert resp.status_code == 200
        assert len(resp.data) == 1
        assert resp.data[0]["full_name"] == "Riya Sharma"

    def test_filter_by_status(self, api_client):
        user = AdminUserFactory()
        PatientFactory(status="active")
        PatientFactory(status="inactive")
        api_client.force_authenticate(user=user)
        resp = api_client.get("/dashboard/api/patients/?status=inactive")
        assert resp.status_code == 200
        assert all(p["status"] == "inactive" for p in resp.data)

    def test_create_patient(self, api_client):
        user = AdminUserFactory()
        api_client.force_authenticate(user=user)
        resp = api_client.post(
            "/dashboard/api/patients/",
            {"full_name": "Test Patient", "village": "TestVillage", "block": "TestBlock"},
            format="json",
        )
        assert resp.status_code == 201
        assert resp.data["full_name"] == "Test Patient"

    def test_update_patient(self, api_client):
        user = AdminUserFactory()
        p = PatientFactory(full_name="Old Name")
        api_client.force_authenticate(user=user)
        resp = api_client.patch(
            f"/dashboard/api/patients/{p.pk}/",
            {"full_name": "New Name"},
            format="json",
        )
        assert resp.status_code == 200
        p.refresh_from_db()
        assert p.full_name == "New Name"

    def test_delete_patient(self, api_client):
        user = AdminUserFactory()
        p = PatientFactory()
        pk = p.pk
        api_client.force_authenticate(user=user)
        resp = api_client.delete(f"/dashboard/api/patients/{pk}/")
        assert resp.status_code == 204
        assert not Patient.objects.filter(pk=pk).exists()

    def test_requires_auth(self, api_client):
        resp = api_client.get("/dashboard/api/patients/")
        assert resp.status_code == 401


@pytest.mark.django_db
class TestDashboardASHAs:
    def test_list_ashas(self, api_client):
        user = AdminUserFactory()
        UserFactory(role=User.Role.HEALTH_WORKER, first_name="ASHA One")
        UserFactory(role=User.Role.HEALTH_WORKER, first_name="ASHA Two")
        api_client.force_authenticate(user=user)
        resp = api_client.get("/dashboard/api/ashas/")
        assert resp.status_code == 200
        names = [a["first_name"] for a in resp.data]
        assert "ASHA One" in names
        assert "ASHA Two" in names

    def test_search_ashas(self, api_client):
        user = AdminUserFactory()
        UserFactory(role=User.Role.HEALTH_WORKER, first_name="Riya", last_name="Sharma")
        UserFactory(role=User.Role.HEALTH_WORKER, first_name="Anita", last_name="Devi")
        api_client.force_authenticate(user=user)
        resp = api_client.get("/dashboard/api/ashas/?search=riya")
        assert resp.status_code == 200
        assert len(resp.data) == 1

    def test_supervisor_sees_registered_only(self, api_client):
        sup = SupervisorFactory(village="", block="", district="")
        asha1 = UserFactory(role=User.Role.HEALTH_WORKER, first_name="Mine")
        UserFactory(role=User.Role.HEALTH_WORKER, first_name="Others")
        WorkerRegistrationFactory(phone=asha1.phone, supervisor=sup, is_active=True)
        api_client.force_authenticate(user=sup)
        resp = api_client.get("/dashboard/api/ashas/")
        names = [a["first_name"] for a in resp.data]
        assert "Mine" in names
        assert "Others" not in names


@pytest.mark.django_db
class TestDashboardFlags:
    def test_list_flags(self, api_client):
        user = AdminUserFactory()
        p = PatientFactory()
        Flag.objects.create(patient=p, flag_type="test", severity="high", status=Flag.Status.OPEN)
        api_client.force_authenticate(user=user)
        resp = api_client.get("/dashboard/api/flags/")
        assert resp.status_code == 200
        assert len(resp.data) >= 1

    def test_update_flag_status(self, api_client):
        user = AdminUserFactory()
        p = PatientFactory()
        flag = Flag.objects.create(patient=p, flag_type="test", severity="low", status=Flag.Status.OPEN)
        api_client.force_authenticate(user=user)
        resp = api_client.patch(
            f"/dashboard/api/flags/{flag.pk}/",
            {"status": Flag.Status.RESOLVED},
            format="json",
        )
        assert resp.status_code == 200
        flag.refresh_from_db()
        assert flag.status == Flag.Status.RESOLVED


@pytest.mark.django_db
class TestDashboardReferrals:
    def test_list_referrals(self, api_client):
        user = AdminUserFactory()
        p = PatientFactory()
        Referral.objects.create(patient=p, destination="PHC", reason="Test", status=Referral.Status.DRAFT)
        api_client.force_authenticate(user=user)
        resp = api_client.get("/dashboard/api/referrals/")
        assert resp.status_code == 200
        assert len(resp.data) >= 1

    def test_update_referral_status(self, api_client):
        user = AdminUserFactory()
        p = PatientFactory()
        ref = Referral.objects.create(patient=p, destination="PHC", reason="Test", status=Referral.Status.DRAFT)
        api_client.force_authenticate(user=user)
        resp = api_client.patch(
            f"/dashboard/api/referrals/{ref.pk}/",
            {"status": Referral.Status.SENT},
            format="json",
        )
        assert resp.status_code == 200
        ref.refresh_from_db()
        assert ref.status == Referral.Status.SENT


@pytest.mark.django_db
class TestDashboardIncentives:
    def test_list_incentives(self, api_client):
        user = AdminUserFactory()
        worker = UserFactory(role=User.Role.HEALTH_WORKER)
        IncentiveLedgerEntry.objects.create(
            worker=worker,
            activity_type=IncentiveLedgerEntry.ActivityType.SURVEY_COMPLETION,
            amount_paise=50000,
            status=IncentiveLedgerEntry.Status.PENDING,
        )
        api_client.force_authenticate(user=user)
        resp = api_client.get("/dashboard/api/incentives/")
        assert resp.status_code == 200
        assert len(resp.data) >= 1

    def test_approve_incentive(self, api_client):
        user = AdminUserFactory()
        worker = UserFactory(role=User.Role.HEALTH_WORKER)
        entry = IncentiveLedgerEntry.objects.create(
            worker=worker,
            activity_type=IncentiveLedgerEntry.ActivityType.SURVEY_COMPLETION,
            amount_paise=50000,
            status=IncentiveLedgerEntry.Status.PENDING,
        )
        api_client.force_authenticate(user=user)
        resp = api_client.post(f"/dashboard/api/incentives/{entry.pk}/approve/")
        assert resp.status_code == 200
        entry.refresh_from_db()
        assert entry.status == IncentiveLedgerEntry.Status.APPROVED

    def test_pay_incentive(self, api_client):
        user = AdminUserFactory()
        worker = UserFactory(role=User.Role.HEALTH_WORKER)
        entry = IncentiveLedgerEntry.objects.create(
            worker=worker,
            activity_type=IncentiveLedgerEntry.ActivityType.SURVEY_COMPLETION,
            amount_paise=50000,
            status=IncentiveLedgerEntry.Status.APPROVED,
        )
        api_client.force_authenticate(user=user)
        entry.approved_at = "2026-05-29T00:00:00Z"
        entry.save()
        resp = api_client.post(f"/dashboard/api/incentives/{entry.pk}/pay/")
        assert resp.status_code == 200
        entry.refresh_from_db()
        assert entry.status == IncentiveLedgerEntry.Status.PAID

    def test_approve_then_pay(self, api_client):
        user = AdminUserFactory()
        worker = UserFactory(role=User.Role.HEALTH_WORKER)
        entry = IncentiveLedgerEntry.objects.create(
            worker=worker,
            activity_type=IncentiveLedgerEntry.ActivityType.SURVEY_COMPLETION,
            amount_paise=50000,
            status=IncentiveLedgerEntry.Status.PENDING,
        )
        api_client.force_authenticate(user=user)
        api_client.post(f"/dashboard/api/incentives/{entry.pk}/approve/")
        resp = api_client.post(f"/dashboard/api/incentives/{entry.pk}/pay/")
        assert resp.status_code == 200
        entry.refresh_from_db()
        assert entry.status == IncentiveLedgerEntry.Status.PAID


@pytest.mark.django_db
class TestDashboardOutbreaksAndHMIS:
    def test_outbreak_detection(self, api_client):
        from risk_engine.models import RiskAssessment

        from tests.factories import HouseholdFactory

        user = AdminUserFactory()

        # Let's create a household and 3 patients in the same village
        hh = HouseholdFactory(village="OutbreakVillage", lat=22.5, lng=88.3)
        p1 = PatientFactory(village="OutbreakVillage", household=hh)
        p2 = PatientFactory(village="OutbreakVillage", household=hh)
        p3 = PatientFactory(village="OutbreakVillage", household=hh)

        # Create 3 risk assessments with explanations containing same symptom code 'fever_3days'
        exps = [{"code": "fever_3days", "name": "Fever for 3+ days", "rule_label_en": "Fever for 3+ days"}]
        RiskAssessment.objects.create(patient=p1, level="medium", explanations=exps)
        RiskAssessment.objects.create(patient=p2, level="medium", explanations=exps)
        RiskAssessment.objects.create(patient=p3, level="medium", explanations=exps)

        api_client.force_authenticate(user=user)
        resp = api_client.get("/dashboard/api/outbreaks/")
        assert resp.status_code == 200
        outbreaks = resp.data["outbreaks"]
        assert len(outbreaks) == 1
        assert outbreaks[0]["village"] == "OutbreakVillage"
        assert outbreaks[0]["symptom"] == "fever_3days"
        assert outbreaks[0]["case_count"] == 3
        assert outbreaks[0]["lat"] == 22.5
        assert outbreaks[0]["lng"] == 88.3

    def test_hmis_csv_export(self, api_client):
        from mcp.models import ANCVisit

        from tests.factories import HouseholdFactory

        user = AdminUserFactory()

        hh = HouseholdFactory(village="HMISVillage")
        p = PatientFactory(village="HMISVillage", pregnancy_status=True, household=hh)
        ANCVisit.objects.create(patient=p, visit_number=1, visit_date="2026-05-15")

        api_client.force_authenticate(user=user)
        resp = api_client.get("/dashboard/api/reports/hmis-export/")
        assert resp.status_code == 200
        assert resp["Content-Type"] == "text/csv"
        content = resp.content.decode("utf-8")
        assert "HMISVillage" in content
        assert "Village Name" in content
        assert "Total Pregnant Women" in content
