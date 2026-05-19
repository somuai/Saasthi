import pytest
from rest_framework.test import APIClient

from accounts.models import User


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def worker():
    return User.objects.create_user(username="worker", phone="+15550000001", role=User.Role.HEALTH_WORKER)


@pytest.fixture
def supervisor():
    return User.objects.create_user(username="supervisor", phone="+15550000002", role=User.Role.SUPERVISOR)


@pytest.fixture
def auth_client(api_client, supervisor):
    api_client.force_authenticate(supervisor)
    return api_client
