from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

User = get_user_model()


class Command(BaseCommand):
    help = "Delete Gonda test ASHA users created by seed_gonda_ashas. Guarded for production safety."

    def add_arguments(self, parser):
        parser.add_argument("--confirm", action="store_true", help="Confirm deletion. Required to proceed.")
        parser.add_argument("--dry-run", action="store_true", help="Preview what would be deleted without deleting.")
        parser.add_argument("--force", action="store_true", help="Override DEBUG guard for CI/staging.")

    def handle(self, *args, **options):
        if not options["confirm"]:
            raise CommandError("This will permanently delete all Gonda test users. Use --confirm to proceed.")

        if not settings.DEBUG and not options.get("force"):
            raise CommandError(
                "Refusing to run outside DEBUG mode in production. Use --force to override (not recommended)."
            )

        dry_run = options["dry_run"]

        gonda_users = User.objects.filter(username__startswith="gonda_")
        total = gonda_users.count()

        if total == 0:
            self.stdout.write("No Gonda test users found. Nothing to delete.")
            return

        self.stdout.write(f"Found {total} Gonda test user(s).")

        if dry_run:
            self.stdout.write("[DRY-RUN] Would delete the following users:")
            for u in gonda_users.order_by("username").values_list("username", "phone", "first_name", "last_name"):
                self.stdout.write(f"  {u[0]} ({u[2]} {u[3]}) — {u[1]}")
            self.stdout.write(f"[DRY-RUN] Would delete {total} user(s).")
            return

        with transaction.atomic():
            deleted_count, _ = gonda_users.delete()

        self.stdout.write(self.style.SUCCESS(f"Deleted {deleted_count} Gonda test user(s)."))
