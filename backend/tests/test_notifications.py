import pytest
from notifications.models import Notification

from tests.factories import UserFactory


@pytest.mark.django_db
class TestNotificationEndpoint:
    endpoint = "/api/v1/notifications/"

    def test_list_empty(self, worker_client, worker):
        resp = worker_client.get(self.endpoint)
        assert resp.status_code == 200
        assert resp.data["results"] == []

    def test_list_own_notifications(self, worker_client, worker):
        Notification.objects.create(recipient=worker, title="Test", body="Hello")
        Notification.objects.create(recipient=worker, title="Second", body="World")
        other = UserFactory()
        Notification.objects.create(recipient=other, title="Other user", body="hidden")
        resp = worker_client.get(self.endpoint)
        assert resp.status_code == 200
        ids = [n["id"] for n in resp.data["results"]]
        assert len(ids) == 2

    def test_admin_sees_all(self, admin_client):
        w1 = UserFactory()
        w2 = UserFactory()
        Notification.objects.create(recipient=w1, title="A", body="x")
        Notification.objects.create(recipient=w2, title="B", body="y")
        resp = admin_client.get(self.endpoint)
        assert resp.status_code == 200
        assert len(resp.data["results"]) == 2

    def test_create_notification(self, worker_client, worker):
        resp = worker_client.post(
            self.endpoint,
            {"recipient": worker.pk, "title": "New alert", "body": "Details here"},
            format="json",
        )
        assert resp.status_code == 201
        assert resp.data["title"] == "New alert"
        assert Notification.objects.count() == 1

    def test_mark_read(self, worker_client, worker):
        n = Notification.objects.create(recipient=worker, title="Unread")
        assert n.read_at is None
        resp = worker_client.post(f"{self.endpoint}{n.pk}/mark_read/")
        assert resp.status_code == 200
        n.refresh_from_db()
        assert n.read_at is not None
        assert resp.data["read_at"] is not None

    def test_mark_read_wrong_user_returns_404(self, api_client, worker):
        other = UserFactory()
        n = Notification.objects.create(recipient=other, title="Secret")
        api_client.force_authenticate(worker)
        resp = api_client.post(f"{self.endpoint}{n.pk}/mark_read/")
        assert resp.status_code == 404

    def test_filter_by_channel(self, worker_client, worker):
        in_app = Notification.objects.create(recipient=worker, title="In-app", channel="in_app")
        sms = Notification.objects.create(recipient=worker, title="SMS", channel="sms")
        resp = worker_client.get(self.endpoint, {"channel": "sms"})
        assert resp.status_code == 200
        ids = [n["id"] for n in resp.data["results"]]
        assert sms.pk in ids
        assert in_app.pk not in ids

    def test_unauthenticated_returns_401(self, api_client):
        resp = api_client.get(self.endpoint)
        assert resp.status_code == 401
