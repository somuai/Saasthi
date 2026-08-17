import pytest

from tests.factories import HouseholdFactory, PatientFactory, SupervisorFactory, UserFactory


@pytest.mark.django_db
class TestFcmTokenRegistration:
    endpoint = "/api/v1/auth/users/fcm-token/"

    def test_register_token(self, worker_client):
        resp = worker_client.post(self.endpoint, {"fcm_token": "abc123"}, format="json")
        assert resp.status_code == 200
        assert resp.data["status"] == "ok"

    def test_register_token_persists(self, worker_client, worker):
        resp = worker_client.post(self.endpoint, {"fcm_token": "def456"}, format="json")
        assert resp.status_code == 200
        worker.refresh_from_db()
        assert worker.fcm_token == "def456"
        assert worker.fcm_token_updated is not None

    def test_register_token_requires_value(self, worker_client):
        resp = worker_client.post(self.endpoint, {}, format="json")
        assert resp.status_code == 400

    def test_unauthenticated_returns_401(self, api_client):
        resp = api_client.post(self.endpoint, {"fcm_token": "xxx"}, format="json")
        assert resp.status_code == 401


@pytest.mark.django_db
class TestMapDataEndpoint:
    endpoint = "/api/v1/registry/patients/map_data/"

    def test_returns_patients_with_gps(self, api_client):
        worker = UserFactory()
        hh = HouseholdFactory(lat=20.5, lng=78.9)
        p = PatientFactory(household=hh, asha_worker=worker)
        api_client.force_authenticate(worker)
        resp = api_client.get(self.endpoint)
        assert resp.status_code == 200
        results = resp.data.get("results")
        assert results is not None
        ids = [r["id"] for r in results]
        assert p.pk in ids
        matching = [r for r in results if r["id"] == p.pk][0]
        assert matching["household_lat"] == 20.5
        assert matching["household_lng"] == 78.9

    def test_filters_patients_without_gps(self, api_client):
        worker = UserFactory()
        hh = HouseholdFactory(lat=None, lng=None)
        PatientFactory(household=hh, asha_worker=worker)
        api_client.force_authenticate(worker)
        resp = api_client.get(self.endpoint)
        assert resp.status_code == 200
        results = resp.data.get("results")
        assert len(results) == 0

    def test_returns_only_own_patients(self, api_client):
        worker = UserFactory()
        other = UserFactory()
        hh = HouseholdFactory(lat=21.0, lng=79.0)
        other_hh = HouseholdFactory(lat=22.0, lng=80.0)
        p1 = PatientFactory(household=hh, asha_worker=worker)
        PatientFactory(household=other_hh, asha_worker=other)
        api_client.force_authenticate(worker)
        resp = api_client.get(self.endpoint)
        assert resp.status_code == 200
        results = resp.data.get("results")
        ids = [r["id"] for r in results]
        assert p1.pk in ids


@pytest.mark.django_db
class TestFhirEndpoint:
    def test_returns_fhir_bundle(self, api_client):
        worker = UserFactory()
        hh = HouseholdFactory()
        p = PatientFactory(household=hh, asha_worker=worker, abha_number="12345678901234", phone="+919999999999")
        api_client.force_authenticate(worker)
        resp = api_client.get(f"/api/v1/registry/patients/{p.pk}/fhir/")
        assert resp.status_code == 200
        assert resp.data["resourceType"] == "Patient"
        assert resp.data["id"] == str(p.local_uuid)

    def test_fhir_includes_identifiers(self, api_client):
        worker = UserFactory()
        hh = HouseholdFactory()
        p = PatientFactory(household=hh, asha_worker=worker, abha_number="98765432109876", mcts_rch_id="RCH001")
        api_client.force_authenticate(worker)
        resp = api_client.get(f"/api/v1/registry/patients/{p.pk}/fhir/")
        identifiers = resp.data.get("identifier", [])
        systems = [i["system"] for i in identifiers]
        assert "https://abdm.gov.in" in systems

    def test_fhir_requires_auth(self, api_client):
        hh = HouseholdFactory()
        p = PatientFactory(household=hh)
        resp = api_client.get(f"/api/v1/registry/patients/{p.pk}/fhir/")
        assert resp.status_code == 401


@pytest.mark.django_db
class TestBulkImport:
    endpoint = "/api/v1/auth/workers/bulk-import/"

    def test_supervisor_can_bulk_import(self, api_client):
        sup = SupervisorFactory()
        api_client.force_authenticate(sup)
        from django.core.files.uploadedfile import SimpleUploadedFile

        csv_content = b"phone,full_name,village,block,district\n9111111111,Sunita Devi,Bagbera,Barhampur,Sitapur\n"
        uploaded = SimpleUploadedFile("workers.csv", csv_content, content_type="text/csv")
        resp = api_client.post(self.endpoint, {"file": uploaded})
        assert resp.status_code == 200, f"Expected 200, got {resp.status_code}: {resp.data}"
        assert resp.data["created"] == 1

    def test_health_worker_cannot_bulk_import(self, api_client):
        from django.core.files.uploadedfile import SimpleUploadedFile

        worker = UserFactory()
        api_client.force_authenticate(worker)
        csv_content = b"phone,full_name\n9199999999,Hack\n"
        uploaded = SimpleUploadedFile("workers.csv", csv_content, content_type="text/csv")
        resp = api_client.post(self.endpoint, {"file": uploaded})
        assert resp.status_code == 403

    def test_bulk_import_requires_file(self, auth_client):
        resp = auth_client.post(self.endpoint, {})
        assert resp.status_code == 400


@pytest.mark.django_db
class TestGemmaQuery:
    endpoint = "/api/v1/risk/assessments/gemma_query/"

    def test_requires_patient_id(self, worker_client):
        resp = worker_client.post(self.endpoint, {}, format="json")
        assert resp.status_code == 400

    def test_returns_mock_recommendation(self, api_client):
        from unittest.mock import patch

        with patch("risk_engine.views.gemma_service.generate") as mock_gen:
            mock_gen.return_value = {
                "english": "Mock recommendation in English",
                "hindi": "हिंदी में नकली सिफारिश",
                "source": "gemma4_api",
                "model": "gemma-4-e2b-it",
            }
            worker = UserFactory()
            hh = HouseholdFactory(village=worker.village, block=worker.block, district=worker.district)
            p = PatientFactory(household=hh, asha_worker=worker)
            api_client.force_authenticate(worker)
            resp = api_client.post(self.endpoint, {"patient_id": p.pk}, format="json")
            assert resp.status_code == 200
            assert "recommendation" in resp.data
            rec = resp.data["recommendation"]
            assert "hindi" in rec
            assert "english" in rec

    def test_patient_access_denied(self, api_client):
        worker = UserFactory()
        other = UserFactory()
        hh = HouseholdFactory()
        p = PatientFactory(household=hh, asha_worker=other)
        api_client.force_authenticate(worker)
        resp = api_client.post(self.endpoint, {"patient_id": p.pk}, format="json")
        assert resp.status_code == 403
