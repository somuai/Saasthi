"""
Seed script to populate MCP demo data: pregnant patient (Sunita Devi)
with 2 ANC visits + child patient (Raju Kumar) with growth records + immunization schedule.

Usage:
    python manage.py shell < scripts/seed_mcp_demo.py
"""

import os
import uuid
from datetime import date, timedelta

import django
from django.conf import settings

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "shaasthi_backend.settings")
django.setup()

from django.db import transaction
from django.utils import timezone

from accounts.models import User
from mcp.models import ANCVisit, GrowthRecord, ImmunizationRecord, MCPSurveySession
from registry.models import Patient

ASHA_PHONE = "9999999990"


def get_or_create_asha():
    user, _ = User.objects.get_or_create(
        phone=ASHA_PHONE,
        defaults={
            "role": "asha",
            "full_name": "Demo ASHA Worker",
            "region": "Demo Region",
            "district": "Demo District",
            "block": "Demo Block",
            "village": "Demo Village",
            "is_active": True,
        },
    )
    return user


def create_pregnant_patient(asha):
    patient, created = Patient.objects.get_or_create(
        local_uuid=uuid.UUID("00000000-0000-0000-0000-000000000001"),
        defaults={
            "full_name": "Sunita Devi",
            "age_years": 24,
            "gender": "female",
            "village": "Demo Village",
            "district": "Demo District",
            "block": "Demo Block",
            "region": "Demo Region",
            "created_by": asha,
            "mcts_rch_id": "MCTS-DEMO-001",
            "gravida": 2,
            "para": 1,
            "lmp_date": date.today() - timedelta(days=140),
            "edd_date": date.today() + timedelta(days=140),
            "high_risk": False,
            "anc_visit_count": 2,
            "is_active": True,
        },
    )
    if created:
        print(f"Created pregnant patient: {patient.full_name} (local_uuid={patient.local_uuid})")
    return patient


def create_anc_visits(patient, asha):
    visit1, _ = ANCVisit.objects.get_or_create(
        patient=patient,
        visit_number=1,
        defaults={
            "asha_worker": asha,
            "visit_date": date.today() - timedelta(days=60),
            "pog_weeks": 12,
            "weight_kg": 52.0,
            "bp_systolic": 110,
            "bp_diastolic": 70,
            "hemoglobin_gms": 11.2,
            "pallor": "absent",
            "fetal_movements": "present",
            "fetal_heart_rate": 140,
            "fundal_height_cm": 12,
            "urine_albumin": "absent",
            "urine_sugar": "absent",
            "tt_injection_given": True,
            "ifa_tablets_given": 30,
            "is_high_risk": False,
        },
    )
    if visit1:
        print(f"  ANC visit 1: POG {visit1.pog_weeks}wks, Hb {visit1.hemoglobin_gms}g/dL")

    visit2, _ = ANCVisit.objects.get_or_create(
        patient=patient,
        visit_number=2,
        defaults={
            "asha_worker": asha,
            "visit_date": date.today() - timedelta(days=14),
            "pog_weeks": 20,
            "weight_kg": 53.5,
            "bp_systolic": 112,
            "bp_diastolic": 72,
            "hemoglobin_gms": 10.8,
            "pallor": "absent",
            "fetal_movements": "present",
            "fetal_heart_rate": 138,
            "fundal_height_cm": 20,
            "urine_albumin": "absent",
            "urine_sugar": "absent",
            "tt_injection_given": True,
            "ifa_tablets_given": 30,
            "calcium_tablets_given": True,
            "is_high_risk": False,
        },
    )
    if visit2:
        print(f"  ANC visit 2: POG {visit2.pog_weeks}wks, Hb {visit2.hemoglobin_gms}g/dL")


def create_child_patient(asha):
    patient, created = Patient.objects.get_or_create(
        local_uuid=uuid.UUID("00000000-0000-0000-0000-000000000002"),
        defaults={
            "full_name": "Raju Kumar",
            "age_years": 1,
            "gender": "male",
            "village": "Demo Village",
            "district": "Demo District",
            "block": "Demo Block",
            "region": "Demo Region",
            "created_by": asha,
            "birth_weight_kg": 2.9,
            "birth_weight_grams": 2900,
            "is_active": True,
        },
    )
    if created:
        print(f"Created child patient: {patient.full_name} (local_uuid={patient.local_uuid})")
    return patient


def create_growth_records(patient, asha):
    records_data = [
        {"months": 0, "weight": 2.9, "muac": 9.5, "status": "normal"},
        {"months": 3, "weight": 5.2, "muac": 11.0, "status": "normal"},
        {"months": 6, "weight": 6.8, "muac": 12.5, "status": "normal"},
        {"months": 9, "weight": 7.8, "muac": 13.0, "status": "normal"},
        {"months": 12, "weight": 8.5, "muac": 13.5, "status": "normal"},
    ]
    for i, rd in enumerate(records_data):
        record_date = date.today() - timedelta(days=(12 - rd["months"]) * 30)
        gr, _ = GrowthRecord.objects.get_or_create(
            patient=patient,
            age_completed_months=rd["months"],
            recorded_date=record_date,
            defaults={
                "asha_worker": asha,
                "recorded_by": "asha",
                "weight_kg": rd["weight"],
                "muac_cm": rd["muac"],
                "wfa_z_score": -0.5 + (i * 0.1),
                "nutritional_status": rd["status"],
                "is_faltering": False,
            },
        )
        if gr:
            print(f"  Growth @ {rd['months']}mo: {rd['weight']}kg, MUAC {rd['muac']}cm")


def create_immunization_schedule(patient, asha):
    vaccines = [
        ("BCG", 0, date.today() - timedelta(days=365)),
        ("HepB", 1, date.today() - timedelta(days=365)),
        ("OPV0", 1, date.today() - timedelta(days=365)),
        ("OPV1", 1, date.today() - timedelta(days=275)),
        ("Penta1", 1, date.today() - timedelta(days=275)),
        ("Rota1", 1, date.today() - timedelta(days=275)),
        ("PCV1", 1, date.today() - timedelta(days=275)),
        ("OPV2", 1, date.today() - timedelta(days=185)),
        ("Penta2", 1, date.today() - timedelta(days=185)),
        ("Rota2", 1, date.today() - timedelta(days=185)),
        ("OPV3", 1, date.today() - timedelta(days=95)),
        ("Penta3", 1, date.today() - timedelta(days=95)),
        ("Rota3", 1, date.today() - timedelta(days=95)),
        ("PCV2", 1, date.today() - timedelta(days=95)),
        ("MR1", 1, date.today() - timedelta(days=0)),
    ]
    for vname, dose, adm_date in vaccines:
        ir, _ = ImmunizationRecord.objects.get_or_create(
            patient=patient,
            vaccine_name=vname,
            dose_number=dose,
            defaults={
                "asha_worker": asha,
                "scheduled_date": adm_date,
                "administered_date": adm_date,
                "administered_at": "Demo PHC",
                "status": "given",
            },
        )
        if ir:
            print(f"  Vaccine {vname} (dose {dose}): {adm_date}")


@transaction.atomic
def seed():
    asha = get_or_create_asha()
    print(f"ASHA worker: {asha.full_name} (phone: {asha.phone})")

    pregnant = create_pregnant_patient(asha)
    create_anc_visits(pregnant, asha)

    child = create_child_patient(asha)
    create_growth_records(child, asha)
    create_immunization_schedule(child, asha)

    MCPSurveySession.objects.get_or_create(
        patient=pregnant,
        session_type="registration",
        session_date=date.today(),
        defaults={"asha_worker": asha},
    )
    MCPSurveySession.objects.get_or_create(
        patient=child,
        session_type="registration",
        session_date=date.today(),
        defaults={"asha_worker": asha},
    )

    print("\nMCP demo data seeded successfully!")
    print(f"  Pregnant: {pregnant.full_name} (local_uuid={pregnant.local_uuid})")
    print(f"  Child: {child.full_name} (local_uuid={child.local_uuid})")


if __name__ == "__main__":
    seed()
