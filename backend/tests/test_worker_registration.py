import pytest
from accounts.models import AuditLog, OTPChallenge, User, WorkerRegistration
from django.core.management import call_command
from django.test import override_settings

from tests.factories import (
    PatientFactory,
    SupervisorFactory,
    UserFactory,
    WorkerRegistrationFactory,
)


@pytest.mark.django_db
@override_settings(EXPOSE_DEBUG_OTP=True)
def test_otp_verify_rejects_unregistered_phone(api_client):
    phone = "+19998887777"
    OTPChallenge.create_for_code(phone, "000000")
    resp = api_client.post(
        "/api/v1/auth/otp/verify/",
        {"phone": phone, "code": "000000"},
        format="json",
    )
    assert resp.status_code in (400, 404)
    assert "not registered" in str(resp.data).lower()


@pytest.mark.django_db
@override_settings(EXPOSE_DEBUG_OTP=True)
def test_otp_verify_copies_geography_from_registration(api_client):
    phone = "+911234567890"
    sup = SupervisorFactory()
    reg = WorkerRegistrationFactory(phone=phone, supervisor=sup)

    OTPChallenge.create_for_code(phone, "000000")
    resp = api_client.post(
        "/api/v1/auth/otp/verify/",
        {"phone": phone, "code": "000000"},
        format="json",
    )
    assert resp.status_code == 200, resp.data

    user = User.objects.get(phone=phone)
    assert user.village == reg.village
    assert user.block == reg.block
    assert user.district == reg.district
    assert user.first_name == reg.full_name


@pytest.mark.django_db
class TestWorkerRegistrationAPI:
    def test_supervisor_can_create_worker(self, api_client):
        sup = SupervisorFactory()
        api_client.force_authenticate(user=sup)
        payload = {
            "phone": "+919876543210",
            "full_name": "Sunita Devi",
            "village": "Bagbera",
            "block": "Barhampur",
            "district": "Sitapur",
        }
        resp = api_client.post("/api/v1/auth/workers/", payload, format="json")
        assert resp.status_code == 201
        assert resp.data["phone"] == payload["phone"]
        assert resp.data["supervisor"] == sup.pk

    def test_supervisor_sees_only_own_workers(self, api_client):
        sup1 = SupervisorFactory()
        sup2 = SupervisorFactory()
        w1 = WorkerRegistrationFactory(supervisor=sup1, phone="+911111111111")
        w2 = WorkerRegistrationFactory(supervisor=sup2, phone="+912222222222")

        api_client.force_authenticate(user=sup1)
        resp = api_client.get("/api/v1/auth/workers/")
        assert resp.status_code == 200
        ids = [r["id"] for r in resp.data["results"]]
        assert w1.pk in ids
        assert w2.pk not in ids

    def test_admin_sees_all_workers(self, api_client):
        admin = UserFactory(role=User.Role.ADMIN)
        sup = SupervisorFactory()
        WorkerRegistrationFactory(supervisor=sup, phone="+913333333333")

        api_client.force_authenticate(user=admin)
        resp = api_client.get("/api/v1/auth/workers/")
        assert resp.status_code == 200
        assert resp.data["count"] >= 1

    def test_deactivate_sets_is_active_false(self, api_client):
        sup = SupervisorFactory()
        reg = WorkerRegistrationFactory(supervisor=sup, phone="+914444444444")

        api_client.force_authenticate(user=sup)
        resp = api_client.delete(f"/api/v1/auth/workers/{reg.pk}/")
        assert resp.status_code == 204

        reg.refresh_from_db()
        assert reg.is_active is False

    def test_health_worker_cannot_create_registration(self, api_client):
        worker = UserFactory()
        api_client.force_authenticate(user=worker)
        resp = api_client.post(
            "/api/v1/auth/workers/",
            {"phone": "+919999999999", "full_name": "Hack"},
            format="json",
        )
        assert resp.status_code == 403


@pytest.mark.django_db
def test_patient_auto_assigns_asha_worker(api_client):
    worker = UserFactory()
    api_client.force_authenticate(user=worker)
    from registry.models import Patient

    resp = api_client.post(
        "/api/v1/registry/patients/",
        {"full_name": "Test Patient", "gender": "female"},
        format="json",
    )
    assert resp.status_code == 201
    patient = Patient.objects.get(pk=resp.data["id"])
    assert patient.asha_worker == worker
    assert patient.created_by == worker


@pytest.mark.django_db
def test_unassigned_workers_endpoint(api_client):
    admin = UserFactory(role=User.Role.ADMIN)
    orphan = UserFactory(requires_review=True, is_active=False)
    gonda_style = UserFactory(requires_review=False, is_active=True, phone="+919988877766")

    api_client.force_authenticate(user=admin)
    resp = api_client.get("/api/v1/auth/workers/unassigned/")
    assert resp.status_code == 200
    ids = [u["id"] for u in resp.data["results"]]
    assert orphan.pk in ids
    assert gonda_style.pk in ids


@pytest.mark.django_db
def test_unassigned_shows_all_unregistered(api_client):
    admin = UserFactory(role=User.Role.ADMIN)
    unreg = UserFactory(requires_review=False, is_active=False, phone="+919988877001")

    api_client.force_authenticate(user=admin)
    resp = api_client.get("/api/v1/auth/workers/unassigned/")
    ids = [u["id"] for u in resp.data["results"]]
    assert unreg.pk in ids


@pytest.mark.django_db
def test_unassigned_excludes_registered_workers(api_client):
    admin = UserFactory(role=User.Role.ADMIN)
    registered_user = UserFactory(requires_review=True, phone="+919000000099")
    WorkerRegistrationFactory(phone=registered_user.phone, is_active=True)

    api_client.force_authenticate(user=admin)
    resp = api_client.get("/api/v1/auth/workers/unassigned/")
    ids = [u["id"] for u in resp.data["results"]]
    assert registered_user.pk not in ids


@pytest.mark.django_db
def test_workers_status_endpoint(api_client):
    sup = SupervisorFactory()
    worker = UserFactory(role=User.Role.HEALTH_WORKER, phone="+919100000001")
    WorkerRegistrationFactory(phone=worker.phone, supervisor=sup, is_active=True)

    api_client.force_authenticate(user=sup)
    resp = api_client.get("/api/v1/auth/workers/status/")
    assert resp.status_code == 200
    ids = [w["id"] for w in resp.data["results"]]
    assert worker.pk in ids
    status_data = next(w for w in resp.data["results"] if w["id"] == worker.pk)
    assert status_data["has_registration"] is True
    assert "patients_count" in status_data
    assert "last_login" in status_data


@pytest.mark.django_db
def test_workers_status_supervisor_scope(api_client):
    sup1 = SupervisorFactory()
    sup2 = SupervisorFactory()
    w1 = UserFactory(role=User.Role.HEALTH_WORKER, phone="+919200000001")
    w2 = UserFactory(role=User.Role.HEALTH_WORKER, phone="+919200000002")
    WorkerRegistrationFactory(phone=w1.phone, supervisor=sup1, is_active=True)
    WorkerRegistrationFactory(phone=w2.phone, supervisor=sup2, is_active=True)

    api_client.force_authenticate(user=sup1)
    resp = api_client.get("/api/v1/auth/workers/status/")
    ids = [w["id"] for w in resp.data["results"]]
    assert w1.pk in ids
    assert w2.pk not in ids


@pytest.mark.django_db
def test_reassign_patients(api_client):
    sup = SupervisorFactory()
    asha1 = UserFactory(role=User.Role.HEALTH_WORKER, phone="+919300000001")
    asha2 = UserFactory(role=User.Role.HEALTH_WORKER, phone="+919300000002")
    patient = PatientFactory(asha_worker=asha1)

    api_client.force_authenticate(user=sup)
    resp = api_client.post(
        "/api/v1/registry/patients/reassign/",
        {"patient_ids": [patient.pk], "new_asha_id": asha2.pk},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.data["reassigned_count"] == 1
    assert resp.data["new_asha_id"] == asha2.pk

    patient.refresh_from_db()
    assert patient.asha_worker == asha2

    assert AuditLog.objects.filter(action="patient.reassign").exists()


@pytest.mark.django_db
def test_reassign_no_permission(api_client):
    asha = UserFactory(role=User.Role.HEALTH_WORKER, phone="+919400000001")
    patient = PatientFactory()

    api_client.force_authenticate(user=asha)
    resp = api_client.post(
        "/api/v1/registry/patients/reassign/",
        {"patient_ids": [patient.pk], "new_asha_id": 99999},
        format="json",
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_reassign_invalid_asha(api_client):
    sup = SupervisorFactory()
    api_client.force_authenticate(user=sup)
    resp = api_client.post(
        "/api/v1/registry/patients/reassign/",
        {"patient_ids": [1], "new_asha_id": 99999},
        format="json",
    )
    assert resp.status_code == 404


@pytest.mark.django_db
def test_asha_metrics_view(api_client):
    sup = SupervisorFactory()
    asha = UserFactory(role=User.Role.HEALTH_WORKER, phone="+919500000001")
    WorkerRegistrationFactory(phone=asha.phone, supervisor=sup, is_active=True)
    PatientFactory(asha_worker=asha, pregnancy_status=True)

    api_client.force_authenticate(user=sup)
    resp = api_client.get(f"/api/v1/dashboard/workers/{asha.pk}/metrics/")
    assert resp.status_code == 200
    assert resp.data["asha_id"] == asha.pk
    assert resp.data["metrics"]["total_patients"] >= 1
    assert "pregnant" in resp.data["metrics"]


@pytest.mark.django_db
def test_asha_metrics_unauthorized(api_client):
    sup1 = SupervisorFactory()
    sup2 = SupervisorFactory()
    asha = UserFactory(role=User.Role.HEALTH_WORKER, phone="+919600000001")
    WorkerRegistrationFactory(phone=asha.phone, supervisor=sup1, is_active=True)

    api_client.force_authenticate(user=sup2)
    resp = api_client.get(f"/api/v1/dashboard/workers/{asha.pk}/metrics/")
    assert resp.status_code == 403


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_delete_gonda_dry_run(api_client):
    UserFactory(
        username="gonda_test_1234567",
        phone="+91991234567",
        is_active=True,
        requires_review=True,
    )
    assert User.objects.filter(username__startswith="gonda_").count() == 1

    call_command("delete_gonda_test_data", dry_run=True, confirm=True)
    assert User.objects.filter(username__startswith="gonda_").count() == 1


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_delete_gonda_confirm_deletes(api_client):
    UserFactory(
        username="gonda_test_7654321",
        phone="+91997654321",
        is_active=True,
        requires_review=True,
    )
    assert User.objects.filter(username__startswith="gonda_").count() == 1

    call_command("delete_gonda_test_data", confirm=True, force=True)
    assert User.objects.filter(username__startswith="gonda_").count() == 0


@pytest.mark.django_db
def test_collect_real_phones_validation():
    from accounts.management.commands.collect_real_phones import _clean_phone

    assert _clean_phone("9876543210") == "+919876543210"
    assert _clean_phone("+919876543210") == "+919876543210"
    assert _clean_phone("919876543210") == "+919876543210"
    assert _clean_phone("12345") is None
    assert _clean_phone("+1 123-456-7890") is None


@pytest.mark.django_db
def test_auto_assign_dry_run():
    asha = UserFactory(role=User.Role.HEALTH_WORKER, requires_review=True)
    patient = PatientFactory(asha_worker=None, village=asha.village, block=asha.block, status="active")

    call_command("auto_assign_patients", dry_run=True)

    patient.refresh_from_db()
    assert patient.asha_worker is None
    assert User.objects.get(pk=asha.pk).requires_review is True


@pytest.mark.django_db
def test_auto_assign_clears_requires_review():
    asha = UserFactory(role=User.Role.HEALTH_WORKER, requires_review=True)
    patient = PatientFactory(asha_worker=None, village=asha.village, block=asha.block, status="active")

    call_command("auto_assign_patients")

    patient.refresh_from_db()
    assert patient.asha_worker == asha
    asha.refresh_from_db()
    assert asha.requires_review is False


@pytest.mark.django_db
def test_auto_assign_skips_gonda_users():
    gonda_asha = UserFactory(
        role=User.Role.HEALTH_WORKER,
        username="gonda_skip_test",
        phone="+919988000001",
    )
    patient = PatientFactory(
        asha_worker=None,
        village=gonda_asha.village,
        block=gonda_asha.block,
        status="active",
    )

    call_command("auto_assign_patients")
    patient.refresh_from_db()
    assert patient.asha_worker is None


@pytest.mark.django_db
def test_supervisor_dashboard_scoped_by_geography(api_client):
    sup = SupervisorFactory(block="Barhampur", district="Sitapur", village="Bagbera")
    PatientFactory(block="Barhampur", district="Sitapur", village="Bagbera")
    PatientFactory(block="Misrikh", district="Sitapur")

    api_client.force_authenticate(user=sup)
    resp = api_client.get("/api/v1/dashboard/summary/")
    assert resp.status_code == 200
    assert resp.data["patients"] == 1, f"Got {resp.data}"


@pytest.mark.django_db
def test_claim_worker_creates_registration_and_activates(api_client):
    sup = SupervisorFactory()
    orphan = UserFactory(
        phone="+919000000001",
        requires_review=True,
        is_active=False,
    )

    api_client.force_authenticate(user=sup)
    resp = api_client.post(f"/api/v1/auth/workers/{orphan.pk}/claim/")
    assert resp.status_code == 201

    orphan.refresh_from_db()
    assert orphan.is_active is True
    assert orphan.requires_review is False

    reg = WorkerRegistration.objects.get(phone=orphan.phone)
    assert reg.supervisor == sup


@pytest.mark.django_db
def test_claim_gonda_style_user(api_client):
    sup = SupervisorFactory()
    gonda = UserFactory(
        phone="+919000000002",
        requires_review=False,
        is_active=True,
    )

    api_client.force_authenticate(user=sup)
    resp = api_client.post(f"/api/v1/auth/workers/{gonda.pk}/claim/")
    assert resp.status_code == 201

    gonda.refresh_from_db()
    assert gonda.requires_review is False
    assert gonda.is_active is True

    reg = WorkerRegistration.objects.get(phone=gonda.phone)
    assert reg.supervisor == sup


@pytest.mark.django_db
def test_duplicate_registration_rejected(api_client):
    sup = SupervisorFactory()
    phone = "+919000000003"
    WorkerRegistrationFactory(phone=phone, supervisor=sup, is_active=True)

    api_client.force_authenticate(user=sup)
    resp = api_client.post(
        "/api/v1/auth/workers/",
        {"phone": phone, "full_name": "Duplicate"},
        format="json",
    )
    assert resp.status_code == 400
    assert "already exists" in str(resp.data).lower()


@pytest.mark.django_db
def test_worker_registration_list_only_active(api_client):
    sup = SupervisorFactory()
    active = WorkerRegistrationFactory(supervisor=sup, phone="+919000000004", is_active=True)
    inactive = WorkerRegistrationFactory(supervisor=sup, phone="+919000000005", is_active=False)

    api_client.force_authenticate(user=sup)
    resp = api_client.get("/api/v1/auth/workers/")
    ids = [r["id"] for r in resp.data["results"]]
    assert active.pk in ids
    assert inactive.pk not in ids


@pytest.mark.django_db
def test_user_serializer_includes_is_active(api_client):
    sup = SupervisorFactory()
    api_client.force_authenticate(user=sup)
    resp = api_client.get("/api/v1/auth/users/me/")
    assert resp.status_code == 200
    assert "is_active" in resp.data


@pytest.mark.django_db
@override_settings(DEBUG=True)
def test_monday_workflow_integration():
    """Full Monday go-live workflow: collect phones → assign (skips Gonda) → delete Gonda."""
    from io import StringIO

    UserFactory(
        username="gonda_integration_test",
        phone="+91991234567",
        is_active=True,
        requires_review=True,
        block="Barhampur",
        village="Bagbera",
    )
    real_asha = UserFactory(
        role=User.Role.HEALTH_WORKER,
        phone="+91991234600",
        is_active=True,
        block="Barhampur",
        village="Bagbera",
    )
    patient = PatientFactory(asha_worker=None, block="Barhampur", village="Bagbera", status="active")

    assert User.objects.filter(username__startswith="gonda_").count() == 1

    out = StringIO()
    call_command("collect_real_phones", all_gonda=True, output="-", stdout=out)
    assert "gonda_integration_test" in out.getvalue()

    call_command("auto_assign_patients")
    patient.refresh_from_db()
    assert patient.asha_worker == real_asha

    call_command("delete_gonda_test_data", confirm=True, force=True, stdout=StringIO())
    assert User.objects.filter(username__startswith="gonda_").count() == 0
