from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from incentives.models import ASHAWorkerProfile

User = get_user_model()


class Command(BaseCommand):
    help = "Creates ASHAWorkerProfile records from existing User metadata (Gonda import data)."

    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0
        skipped_count = 0

        for user in User.objects.filter(role=User.Role.HEALTH_WORKER).iterator(chunk_size=200):
            meta = user.metadata or {}
            asha_id = meta.get("asha_id")
            if not asha_id:
                skipped_count += 1
                continue

            _, created = ASHAWorkerProfile.objects.update_or_create(
                user=user,
                defaults={
                    "asha_id": str(asha_id),
                    "husband_name": meta.get("husband_name", ""),
                    "is_active": user.is_active,
                },
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"ASHA profiles synced: {created_count} created, {updated_count} updated, {skipped_count} skipped."
            )
        )
