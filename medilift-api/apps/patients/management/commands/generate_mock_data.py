from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

from apps.patients.models import Household, Patient
from apps.sync_api.registry import now_ms

try:
    from faker import Faker
except ImportError:
    Faker = None


class Command(BaseCommand):
    help = "Generate mock ASHA worker + patient data for dev sync testing"

    def add_arguments(self, parser):
        parser.add_argument("--workers", type=int, default=1, help="Number of demo ASHA users")
        parser.add_argument("--patients", type=int, default=1, help="Patients per worker")
        parser.add_argument("--use-faker", action="store_true", help="Use Faker for names (pip install faker)")

    def handle(self, *args, **options):
        n_workers = max(1, options["workers"])
        n_patients = max(1, options["patients"])
        use_faker = options["use_faker"] and Faker is not None
        fake = Faker("en_IN") if use_faker else None
        if options["use_faker"] and not Faker:
            self.stdout.write(self.style.WARNING("faker not installed — using static names"))

        for w in range(n_workers):
            phone = f"9198765432{w:02d}"
            user, _ = User.objects.get_or_create(
                username=phone,
                defaults={
                    "email": f"demo{w}@medilift.local",
                    "first_name": fake.first_name() if fake else "Demo",
                    "last_name": fake.last_name() if fake else f"ASHA{w}",
                },
            )
            worker_id = str(user.id)
            ts = now_ms()

            for p in range(n_patients):
                hh_id = f"mock-hh-{w}-{p}"
                pt_id = f"mock-patient-{w}-{p}"
                head = fake.name() if fake else f"Demo Family {w}-{p}"
                name = fake.name() if fake else f"Demo Patient {w}-{p}"
                Household.objects.update_or_create(
                    id=hh_id,
                    defaults={
                        "household_code": f"HH-DEMO-{w:03d}-{p:04d}",
                        "head_of_family": head,
                        "village": fake.city() if fake else "Gopalpur",
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
                        "patient_code": f"WB-DEMO-{w:03d}-P-{p:04d}",
                        "household_id": hh_id,
                        "name": name,
                        "age": fake.random_int(18, 65) if fake else 28,
                        "gender": fake.random_element(["F", "M"]) if fake else "F",
                        "is_pregnant": p % 3 == 0,
                        "risk_score": fake.random_int(5, 40) if fake else 12,
                        "risk_level": "low",
                        "asha_worker_server_id": worker_id,
                        "is_synced": True,
                        "created_at": ts,
                        "updated_at": ts,
                        "is_deleted": False,
                        "is_mock": True,
                    },
                )

            self.stdout.write(
                self.style.SUCCESS(
                    f"Worker {worker_id}: +91{phone[-10:]} — {n_patients} patient(s)"
                )
            )
