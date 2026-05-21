from datetime import date

import pytest
from django.utils import timezone

from accounts.models import User
from registry.models import Patient


@pytest.fixture
def patient():
    return Patient.objects.create(full_name="Test Patient", gender="female", village="Central")


@pytest.fixture
def worker():
    return User.objects.create_user(username="worker", phone="+15550000001", role=User.Role.HEALTH_WORKER)


@pytest.fixture
def followup(patient, worker):
    from followups.models import FollowUp

    return FollowUp.objects.create(patient=patient, worker=worker, scheduled_date=date.today())
