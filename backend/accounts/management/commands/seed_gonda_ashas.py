import os

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

User = get_user_model()


class Command(BaseCommand):
    help = "Seeds ASHA workers from Gonda district registry into the User database."

    def add_arguments(self, parser):
        parser.add_argument(
            "--file",
            default="/Users/soumyajitghosh/Downloads/gonda_extracted.txt",
            help="Path to the extracted Gonda ASHA registry text file",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Override DEBUG guard (not recommended in production).",
        )

    def handle(self, *args, **options):
        if not settings.DEBUG and not options.get("force"):
            raise CommandError("seed_gonda_ashas is for development/testing only. Use --force to override.")
        filepath = options["file"]
        if not os.path.exists(filepath):
            raise CommandError(f"Registry file not found at: {filepath}")

        self.stdout.write(f"Reading ASHA workers from {filepath}...")
        parsed_records = []
        skipped_count = 0

        with open(filepath, encoding="utf-8") as f:
            for idx, line in enumerate(f, 1):
                line = line.strip()
                if not line or line.startswith("---") or "Name Of" in line or "ASHA Database" in line:
                    continue

                parts = line.split()
                if not parts:
                    continue

                # Ensure first element is serial number
                if not parts[0].isdigit():
                    skipped_count += 1
                    continue

                if len(parts) < 8:
                    skipped_count += 1
                    continue

                # Find 7-digit ASHA ID to realign split shifts (in case of spaces in sub-centre names)
                asha_id = parts[5]
                if not asha_id.isdigit() or len(asha_id) != 7:
                    found_id_idx = -1
                    for p_idx, part in enumerate(parts):
                        if part.isdigit() and len(part) == 7:
                            found_id_idx = p_idx
                            break

                    if found_id_idx != -1:
                        district = parts[1]
                        block = parts[2]
                        chc = parts[3]
                        sub_centre = " ".join(parts[4:found_id_idx])
                        asha_id = parts[found_id_idx]
                        after_parts = parts[found_id_idx + 1 :]
                    else:
                        skipped_count += 1
                        continue
                else:
                    district = parts[1]
                    block = parts[2]
                    chc = parts[3]
                    sub_centre = parts[4]
                    after_parts = parts[6:]

                if not after_parts:
                    skipped_count += 1
                    continue

                # Extract population and village
                pop_str = after_parts[-1]
                if pop_str.isdigit():
                    population = int(pop_str)
                    village = after_parts[-2] if len(after_parts) >= 2 else "Unknown"
                    name_parts = after_parts[:-2]
                else:
                    population = 0
                    village = after_parts[-1]
                    name_parts = after_parts[:-1]

                # Parse ASHA Name and Husband Name
                if len(name_parts) >= 2:
                    mid = (len(name_parts) + 1) // 2
                    asha_name = " ".join(name_parts[:mid]).strip().title()
                    husband_name = " ".join(name_parts[mid:]).strip().title()
                elif len(name_parts) == 1:
                    asha_name = name_parts[0].strip().title()
                    husband_name = ""
                else:
                    asha_name = "Unknown"
                    husband_name = ""

                parsed_records.append(
                    {
                        "district": district.strip().title(),
                        "block": block.strip().title(),
                        "chc": chc.strip().title(),
                        "sub_centre": sub_centre.strip().title(),
                        "asha_id": asha_id,
                        "asha_name": asha_name,
                        "husband_name": husband_name,
                        "village": village.strip().title(),
                        "population": population,
                    }
                )

        total_records = len(parsed_records)
        self.stdout.write(f"Parsed {total_records} valid ASHA records (skipped {skipped_count} lines).")
        self.stdout.write(
            "Importing into database (this will create or update users in a single atomic transaction)..."
        )

        created_count = 0
        updated_count = 0

        with transaction.atomic():
            for r in parsed_records:
                asha_id = r["asha_id"]
                username = f"gonda_{asha_id}"
                phone = f"+91990{asha_id}"  # Generate a unique 10-digit Indian phone number

                # Separate first_name and last_name
                name_words = r["asha_name"].split()
                first_name = name_words[0] if name_words else "ASHA"
                last_name = " ".join(name_words[1:]) if len(name_words) > 1 else ""

                user, created = User.objects.update_or_create(
                    username=username,
                    defaults={
                        "phone": phone,
                        "role": User.Role.HEALTH_WORKER,
                        "requires_review": True,
                        "first_name": first_name,
                        "last_name": last_name,
                        "district": r["district"],
                        "block": r["block"],
                        "village": r["village"],
                        "region": r["sub_centre"],  # Sub-centre maps directly to User's region field
                        "metadata": {
                            "asha_id": asha_id,
                            "husband_name": r["husband_name"],
                            "chc": r["chc"],
                            "population_covered": r["population"],
                        },
                    },
                )

                if created:
                    # OTP authentication bypasses passwords - set unusable password for instant creation and maximum security
                    user.set_unusable_password()
                    user.save()
                    created_count += 1
                else:
                    updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully seeded Gonda ASHA database! {created_count} created, {updated_count} updated."
            )
        )
