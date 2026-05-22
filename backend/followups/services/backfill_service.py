import csv
import io
from datetime import datetime

from django.db import transaction

from accounts.models import User
from registry.models import FollowUp


def classify_backfill_status(patient):
    """Determine backfill status for a patient created via CSV import."""
    from registry.models import RiskLevel

    fu = FollowUp.objects.filter(patient=patient).order_by("-created_at").first()
    if not fu:
        return "no_visit"
    if fu.risk_score is None:
        return "no_assessment"
    if fu.risk_score > 50:
        return "high_risk"
    if fu.risk_score > 25:
        return "medium_risk"
    return "low_risk"


def import_historical_patients_csv(csv_content, created_by_user):
    """Import historical MCP card data from CSV.

    Expected columns: patient_name, age, gender, phone, village,
                      condition, notes, visit_date (YYYY-MM-DD)
    """
    decoded = csv_content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(decoded))

    results = {"created": 0, "errors": []}
    required = {"patient_name", "age", "gender", "visit_date"}

    rows = list(reader)
    if not rows:
        return {**results, "errors": ["CSV is empty"]}

    headers = set(rows[0].keys())
    missing = required - headers
    if missing:
        return {**results, "errors": [f"Missing columns: {', '.join(sorted(missing))}"]}

    from registry.models import Patient, RiskLevel

    with transaction.atomic():
        for i, row in enumerate(rows, start=2):
            try:
                patient_name = row["patient_name"].strip()
                age = int(row["age"].strip())
                gender = row.get("gender", "").strip().lower()
                phone = row.get("phone", "").strip()
                village = row.get("village", "").strip()
                condition = row.get("condition", "").strip()
                notes = row.get("notes", "").strip()
                visit_date_str = row.get("visit_date", "").strip()

                visit_date = None
                if visit_date_str:
                    try:
                        visit_date = datetime.strptime(visit_date_str, "%Y-%m-%d").date()
                    except ValueError:
                        results["errors"].append(f"Row {i}: invalid date '{visit_date_str}', using today")
                        visit_date = datetime.today().date()

                patient, _ = Patient.objects.get_or_create(
                    phone=phone or None,
                    defaults={
                        "full_name": patient_name,
                        "age": age,
                        "gender": gender,
                        "village": village,
                        "created_by": created_by_user,
                    },
                )

                FollowUp.objects.create(
                    patient=patient,
                    created_by=created_by_user,
                    follow_type="field_visit",
                    condition=condition or None,
                    notes=notes or None,
                    visit_date=visit_date or datetime.today().date(),
                    source="backfill",
                )

                results["created"] += 1
            except Exception as exc:
                results["errors"].append(f"Row {i}: {exc}")

    return results
