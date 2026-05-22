import pytest
from registry.models import Patient
from rest_framework.test import APIClient

from .factories import (
    AdminUserFactory,
    HouseholdFactory,
    PatientFactory,
    SupervisorFactory,
    UserFactory,
)


@pytest.fixture(autouse=True)
def _celery_eager(settings):
    settings.CELERY_TASK_ALWAYS_EAGER = True


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def worker():
    return UserFactory()


@pytest.fixture
def worker_client(api_client, worker):
    api_client.force_authenticate(worker)
    return api_client


@pytest.fixture
def supervisor():
    return SupervisorFactory()


@pytest.fixture
def auth_client(api_client, supervisor):
    api_client.force_authenticate(supervisor)
    return api_client


@pytest.fixture
def admin_user():
    return AdminUserFactory()


@pytest.fixture
def admin_client(api_client, admin_user):
    api_client.force_authenticate(admin_user)
    return api_client


@pytest.fixture
def sample_patient():
    return Patient.objects.create(full_name="Test Patient", gender="female", village="Central Village")


@pytest.fixture
def household(worker):
    return HouseholdFactory()


@pytest.fixture
def patient(household, worker):
    return PatientFactory(household=household, asha_worker=worker)


@pytest.fixture
def seed_risk_rules():
    from django.core.management import call_command
    call_command("seed_risk_rules")
