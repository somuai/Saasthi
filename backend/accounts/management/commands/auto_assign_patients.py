from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from registry.models import Patient

User = get_user_model()


class Command(BaseCommand):
    help = "Auto-assign unassigned patients to ASHA workers by matching village/block geography."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Show what would be assigned without saving.")
        parser.add_argument("--block", help="Restrict to a specific block.")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        block_filter = options.get("block")

        patients_qs = Patient.objects.filter(asha_worker__isnull=True, status="active").exclude(village="", block="")

        if block_filter:
            patients_qs = patients_qs.filter(block=block_filter)

        total_patients = patients_qs.count()
        if total_patients == 0:
            self.stdout.write("No unassigned active patients found.")
            return

        self.stdout.write(f"Found {total_patients} unassigned patient(s).")

        assigned_count = 0
        skipped_no_match = 0
        onboarded_ashas = set()

        with transaction.atomic():
            for patient in patients_qs.iterator(chunk_size=200):
                base_qs = (
                    User.objects.filter(
                        role=User.Role.HEALTH_WORKER,
                        is_active=True,
                    )
                    .exclude(
                        phone__isnull=True,
                    )
                    .exclude(
                        username__startswith="gonda_",
                    )
                )
                asha = base_qs.filter(
                    village=patient.village,
                    block=patient.block,
                ).first()
                if not asha:
                    asha = base_qs.filter(
                        block=patient.block,
                    ).first()
                if not asha:
                    skipped_no_match += 1
                    continue
                if dry_run:
                    self.stdout.write(
                        f"  Would assign {patient.full_name} (village={patient.village}, "
                        f"block={patient.block}) -> ASHA {asha.get_full_name() or asha.phone}"
                    )
                else:
                    patient.asha_worker = asha
                    patient.save(update_fields=["asha_worker"])
                    if asha.pk not in onboarded_ashas and asha.requires_review:
                        asha.requires_review = False
                        asha.save(update_fields=["requires_review"])
                        onboarded_ashas.add(asha.pk)
                assigned_count += 1

        if dry_run:
            self.stdout.write(
                f"[DRY-RUN] Would assign {assigned_count} patient(s). {skipped_no_match} had no matching ASHA."
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(f"Assigned {assigned_count} patient(s). {skipped_no_match} had no matching ASHA.")
            )
