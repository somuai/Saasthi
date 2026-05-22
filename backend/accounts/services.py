import csv
import io
from datetime import datetime

from django.db import transaction

from .models import User, WorkerRegistration


def import_workers_csv(csv_content, supervisor, file_name=""):
    decoded = csv_content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(decoded))

    results = {"created": 0, "updated": 0, "errors": []}
    required_fields = {"phone", "full_name"}

    rows = list(reader)
    if not rows:
        return {"created": 0, "updated": 0, "errors": ["CSV is empty or has no data rows"]}

    headers = set(rows[0].keys())
    missing = required_fields - headers
    if missing:
        return {"created": 0, "updated": 0, "errors": [f"Missing columns: {', '.join(sorted(missing))}"]}

    with transaction.atomic():
        for i, row in enumerate(rows, start=2):
            phone = row.get("phone", "").strip()
            full_name = row.get("full_name", "").strip()
            if not phone or not full_name:
                results["errors"].append(f"Row {i}: phone and full_name are required")
                continue
            if len(phone) != 10 or not phone.isdigit():
                results["errors"].append(f"Row {i}: invalid phone '{phone}'")
                continue

            village = row.get("village", "").strip()
            block = row.get("block", "").strip()
            district = row.get("district", "").strip()

            worker, created = WorkerRegistration.objects.update_or_create(
                phone=phone,
                defaults={
                    "full_name": full_name,
                    "village": village,
                    "block": block,
                    "district": district,
                    "supervisor": supervisor,
                    "is_active": True,
                },
            )
            if created:
                User.objects.update_or_create(
                    phone=phone,
                    defaults={
                        "first_name": full_name,
                        "role": User.Role.HEALTH_WORKER,
                        "is_active": True,
                        "requires_review": False,
                        "region": row.get("region", "").strip(),
                        "district": district,
                        "block": block,
                        "village": village,
                    },
                )
                results["created"] += 1
            else:
                worker.supervisor = supervisor
                worker.save(update_fields=["supervisor"])
                results["updated"] += 1

    return results
