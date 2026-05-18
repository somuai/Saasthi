from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

from apps.patients.models import Household, Patient
from apps.sync_api.registry import now_ms


class Command(BaseCommand):
    help = "Generate mock ASHA worker data for dev sync testing"

    def handle(self, *args, **options):
        user, _ = User.objects.get_or_create(
            username="919876543210",
            defaults={"email": "demo@medilift.local", "first_name": "Demo", "last_name": "ASHA"},
        )
        worker_id = str(user.id)
        ts = now_ms()
        hh_id = "mock-hh-001"
        pt_id = "mock-patient-001"
        Household.objects.update_or_create(
            id=hh_id,
            defaults={
                "household_code": "HH-DEMO-001",
                "head_of_family": "Demo Family",
                "village": "Gopalpur",
                "asha_worker_id": worker_id,
                "is_synced": True,
                "created_at": ts,
                "updated_at": ts,
                "is_deleted": False,
                "is_mock": True,
            },
        )
        Patient.objects.update_or_create(
            id=pt_id,
            defaults={
                "patient_code": "WB-DEMO-P-001",
                "household_id": hh_id,
                "name": "Demo Patient",
                "age": 28,
                "gender": "F",
                "is_pregnant": True,
                "risk_score": 12,
                "risk_level": "low",
                "asha_worker_server_id": worker_id,
                "is_synced": True,
                "created_at": ts,
                "updated_at": ts,
                "is_deleted": False,
                "is_mock": True,
            },
        )
        self.stdout.write(self.style.SUCCESS(f"Mock data for worker {worker_id} (login +91{user.username[-10:]})"))
