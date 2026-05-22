import pytest
from accounts.models import OTPChallenge, User, WorkerRegistration
from django.test import override_settings

from tests.factories import SupervisorFactory, UserFactory, WorkerRegistrationFactory


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
    assert resp.status_code == 400
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

    api_client.force_authenticate(user=admin)
    resp = api_client.get("/api/v1/auth/workers/unassigned/")
    assert resp.status_code == 200
    ids = [u["id"] for u in resp.data["results"]]
    assert orphan.pk in ids


@pytest.mark.django_db
def test_claim_worker_creates_registration_and_activates(api_client):
    sup = SupervisorFactory()
    orphan = UserFactory(
        phone="+919000000001", requires_review=True, is_active=False,
    )

    api_client.force_authenticate(user=sup)
    resp = api_client.post(f"/api/v1/auth/workers/{orphan.pk}/claim/")
    assert resp.status_code == 201

    orphan.refresh_from_db()
    assert orphan.is_active is True
    assert orphan.requires_review is False

    reg = WorkerRegistration.objects.get(phone=orphan.phone)
    assert reg.supervisor == sup
