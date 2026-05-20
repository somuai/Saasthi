"""Delete local SQLite DB and re-apply migrations (development only)."""

from pathlib import Path

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError


class Command(BaseCommand):
    help = (
        "Remove local SQLite database file and run migrate from scratch. "
        "Use when you see InconsistentMigrationHistory or stale schema."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--yes",
            action="store_true",
            help="Skip confirmation prompt",
        )
        parser.add_argument(
            "--seed-risk",
            action="store_true",
            help="Run seed_risk_rules after migrate",
        )

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("reset_dev_database is only allowed when DEBUG=True")

        db = settings.DATABASES["default"]
        engine = db.get("ENGINE", "")
        if "sqlite3" not in engine:
            raise CommandError("reset_dev_database only supports SQLite (local dev)")

        db_path = Path(db["NAME"])
        if not db_path.is_absolute():
            db_path = Path(settings.BASE_DIR) / db_path

        if db_path.exists() and not options["yes"]:
            self.stdout.write(
                self.style.WARNING(f"This will delete {db_path} and all local data.")
            )
            confirm = input("Type 'yes' to continue: ")
            if confirm.strip().lower() != "yes":
                raise CommandError("Aborted")

        if db_path.exists():
            db_path.unlink()
            self.stdout.write(self.style.WARNING(f"Deleted {db_path}"))

        call_command("migrate", verbosity=options.get("verbosity", 1))
        self.stdout.write(self.style.SUCCESS("Migrations applied."))

        if options["seed_risk"]:
            call_command("seed_risk_rules")
            self.stdout.write(self.style.SUCCESS("Risk rules seeded."))
