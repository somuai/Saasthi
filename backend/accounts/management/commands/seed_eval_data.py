from django.core.management.base import BaseCommand

from accounts.models import WorkerRegistration


class Command(BaseCommand):
    help = "Seed test data for eval scenarios (CI live-eval)"

    def handle(self, *args, **options):
        phones = [
            "+919988776601",
            "+919988776602",
            "+919988776603",
            "+919988776604",
        ]
        created = 0
        for phone in phones:
            _, is_new = WorkerRegistration.objects.get_or_create(
                phone=phone,
                defaults={
                    "full_name": f"Eval Worker {phone[-4:]}",
                    "village": "Test Village",
                    "block": "Test Block",
                    "district": "Test District",
                    "region": "Test Region",
                    "is_active": True,
                },
            )
            if is_new:
                created += 1
        self.stdout.write(f"Done. Seeded {created} worker registration(s).")
