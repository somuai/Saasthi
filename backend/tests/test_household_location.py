import pytest

from tests.factories import HouseholdFactory


@pytest.mark.django_db
class TestHouseholdLocationEndpoint:
    endpoint = "/api/v1/registry/households/"

    def test_set_location(self, api_client, worker):
        hh = HouseholdFactory()
        api_client.force_authenticate(worker)
        resp = api_client.patch(f"{self.endpoint}{hh.pk}/location/", {"lat": 28.6139, "lng": 77.2090}, format="json")
        assert resp.status_code == 200
        assert resp.data["detail"] == "Location saved."
        hh.refresh_from_db()
        assert hh.lat == 28.6139
        assert hh.lng == 77.2090

    def test_missing_lat(self, api_client, worker):
        hh = HouseholdFactory()
        api_client.force_authenticate(worker)
        resp = api_client.patch(f"{self.endpoint}{hh.pk}/location/", {"lng": 77.2090}, format="json")
        assert resp.status_code == 400
        assert "lat and lng are required" in resp.data["detail"]

    def test_missing_lng(self, api_client, worker):
        hh = HouseholdFactory()
        api_client.force_authenticate(worker)
        resp = api_client.patch(f"{self.endpoint}{hh.pk}/location/", {"lat": 28.6139}, format="json")
        assert resp.status_code == 400
        assert "lat and lng are required" in resp.data["detail"]

    def test_no_auth_returns_401(self, api_client):
        hh = HouseholdFactory()
        resp = api_client.patch(f"{self.endpoint}{hh.pk}/location/", {"lat": 28.6, "lng": 77.2}, format="json")
        assert resp.status_code == 401

    def test_not_found_returns_404(self, api_client, worker):
        api_client.force_authenticate(worker)
        resp = api_client.patch(f"{self.endpoint}999999/location/", {"lat": 28.6, "lng": 77.2}, format="json")
        assert resp.status_code == 404
