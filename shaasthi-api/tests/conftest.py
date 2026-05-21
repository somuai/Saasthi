import pytest
from rest_framework.test import APIClient

from accounts.models import User
from registry.models import Patient

@pytest.fixture(autouse=True)
def _celery_eager(settings):
    settings.CELERY_TASK_ALWAYS_EAGER = True


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
def admin_user():
    return User.objects.create_user(username="admin", phone="+15550000099", role=User.Role.ADMIN)


@pytest.fixture
def admin_client(api_client, admin_user):
    api_client.force_authenticate(admin_user)
    return api_client


@pytest.fixture
def auth_client(api_client, supervisor):
    api_client.force_authenticate(supervisor)
    return api_client


@pytest.fixture
def sample_patient():
    return Patient.objects.create(full_name="Test Patient", gender="female", village="Central Village")
