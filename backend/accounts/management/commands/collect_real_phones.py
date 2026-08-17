import csv
import re

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q

User = get_user_model()

_PHONE_RE = re.compile(r"^\+?91?\d{10}$")


def _clean_phone(raw):
    cleaned = re.sub(r"[^\d]", "", raw.strip())
    if len(cleaned) == 10:
        return f"+91{cleaned}"
    if len(cleaned) == 12 and cleaned.startswith("91"):
        return f"+{cleaned}"
    return None


class Command(BaseCommand):
    help = "Update synthetic Gonda ASHA phone numbers with real numbers for production onboarding."

    def add_arguments(self, parser):
        parser.add_argument("csv_file", nargs="?", help="CSV with columns: asha_id,phone")
        parser.add_argument("--asha-id", help="Single User primary key or username")
        parser.add_argument("--phone", help="Real phone number (10-digit or +91XXXXXXXXXX)")
        parser.add_argument(
            "--all-gonda", action="store_true", help="List/inventory all Gonda users with synthetic phones"
        )
        parser.add_argument("--output", nargs="?", const="-", help="Write CSV template to file (default: stdout)")
        parser.add_argument("--dry-run", action="store_true", help="Validate without saving")

    def handle(self, *args, **options):
        csv_file = options.get("csv_file")
        asha_id = options.get("asha_id")
        phone = options.get("phone")
        all_gonda = options["all_gonda"]
        output = options.get("output")
        dry_run = options["dry_run"]

        if all_gonda:
            self._list_gonda_users(dry_run, output)
        elif csv_file:
            self._handle_csv(csv_file, dry_run)
        elif asha_id and phone:
            self._handle_single(asha_id, phone, dry_run)
        else:
            raise CommandError("Provide a CSV file path, --asha-id with --phone, or --all-gonda.")

    def _list_gonda_users(self, dry_run, output=None):
        gonda_users = User.objects.filter(username__startswith="gonda_", phone__startswith="+9199").order_by("username")

        total = gonda_users.count()
        self.stdout.write(f"Found {total} Gonda user(s) with synthetic phones.")

        if output:
            self._write_csv_template(gonda_users, output)
            return

        self.stdout.write("")
        self.stdout.write(f"{'Username':<24} {'Current Phone':<20} {'Name':<30}")
        self.stdout.write("-" * 74)
        for u in gonda_users:
            self.stdout.write(f"{u.username:<24} {u.phone:<20} {(u.first_name + ' ' + u.last_name).strip():<30}")

        if total and dry_run:
            self.stdout.write("")
            self.stdout.write("[DRY-RUN] To update, use:")
            self.stdout.write("  python manage.py collect_real_phones <csv_file>")
            self.stdout.write("  with CSV columns: asha_id,phone")
            self.stdout.write("")
            self.stdout.write("  Or update individually:")
            self.stdout.write("  python manage.py collect_real_phones --asha-id <id> --phone <real_phone>")

    def _write_csv_template(self, users, output):
        if output == "-":
            writer = csv.writer(self.stdout)
            writer.writerow(["asha_id", "phone"])
            for u in users:
                writer.writerow([u.username, ""])
        else:
            with open(output, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(["asha_id", "phone"])
                for u in users:
                    writer.writerow([u.username, ""])
            self.stdout.write(self.style.SUCCESS(f"Wrote CSV template to {output}"))

    def _handle_single(self, asha_id, phone, dry_run):
        cleaned = _clean_phone(phone)
        if not cleaned:
            raise CommandError(f"Invalid phone number: {phone}. Use 10-digit or +91XXXXXXXXXX format.")

        existing = User.objects.filter(phone=cleaned).exclude(Q(username=asha_id) | Q(pk=asha_id)).first()
        if existing:
            raise CommandError(f"Phone {cleaned} is already used by user {existing.username}.")

        user = User.objects.filter(Q(username=asha_id) | Q(pk=asha_id)).first()
        if not user:
            raise CommandError(f"No user found with id/username '{asha_id}'.")

        old_phone = user.phone
        if dry_run:
            self.stdout.write(f"[DRY-RUN] Would update {user.username}: {old_phone} -> {cleaned}")
            return

        with transaction.atomic():
            user.phone = cleaned
            user.save(update_fields=["phone"])
        self.stdout.write(self.style.SUCCESS(f"Updated {user.username}: {old_phone} -> {cleaned}"))

    def _handle_csv(self, csv_path, dry_run):
        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            if "asha_id" not in (reader.fieldnames or []) or "phone" not in (reader.fieldnames or []):
                raise CommandError("CSV must have 'asha_id' and 'phone' columns.")

            updates = []
            errors = []
            for row in reader:
                asha_id = row["asha_id"].strip()
                phone = row["phone"].strip()
                cleaned = _clean_phone(phone)
                if not cleaned:
                    errors.append(f"Row {reader.line_num}: invalid phone '{phone}'")
                    continue
                user = User.objects.filter(Q(username=asha_id) | Q(pk=asha_id)).first()
                if not user:
                    errors.append(f"Row {reader.line_num}: no user '{asha_id}'")
                    continue
                conflict = User.objects.filter(phone=cleaned).exclude(pk=user.pk).first()
                if conflict:
                    errors.append(f"Row {reader.line_num}: phone {cleaned} in use by {conflict.username}")
                    continue
                updates.append((user, cleaned))

        if errors:
            for e in errors:
                self.stdout.write(self.style.ERROR(e))

        if dry_run:
            self.stdout.write(f"[DRY-RUN] Would update {len(updates)} phone(s).")
            for user, new_phone in updates:
                self.stdout.write(f"  {user.username}: {user.phone} -> {new_phone}")
            return

        with transaction.atomic():
            for user, new_phone in updates:
                user.phone = new_phone
                user.save(update_fields=["phone"])

        self.stdout.write(self.style.SUCCESS(f"Updated {len(updates)} phone number(s). {len(errors)} error(s)."))
