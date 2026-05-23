import hashlib
import json
import logging
import time
import uuid
from datetime import datetime

from django.db import IntegrityError, transaction
from django.utils import timezone as tz
from flagging.models import Flag
from flagging.services import dedupe_key
from followups.models import FollowUp
from followups.services.gps_service import classify_gps_visit
from incentives.models import IncentiveLedgerEntry
from mcp.models import CareInteraction
from referrals.models import Referral
from registry.models import Household, Patient
from registry.serializers import HouseholdSerializer, PatientSerializer
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from risk_engine.hooks import enqueue_risk_assessment
from shaasthi_backend.querysets import for_user_geography
from shaasthi_backend.throttling import SyncPushThrottle
from surveys.models import SurveyResponse
from surveys.serializers import SurveyResponseSerializer

from .models import SyncEvent
from .serializers import SyncPushSerializer

logger = logging.getLogger(__name__)

# ── WatermelonDB table name → internal model name ───────────
TABLE_TO_MODEL = {
    "patients": "patient",
    "households": "household",
    "survey_responses": "survey_response",
    "follow_ups": "follow_up",
    "flags": "flag",
    "referrals": "referral",
    "mother_records": "care_interaction",
    "immunization_records": "care_interaction",
    "growth_records": "care_interaction",
    "incentive_records": "incentive_ledger_entry",
    "anc_visit_records": "care_interaction",
    "child_development": "care_interaction",
}

# ── WatermelonDB column names per table (from schema.js) ────
WATERMELON_BASE = {"server_id", "is_synced", "created_at", "updated_at", "is_deleted", "is_mock"}

WATERMELON_COLUMNS = {
    "patients": WATERMELON_BASE
    | {
        "patient_code",
        "household_id",
        "name",
        "age",
        "gender",
        "phone",
        "aadhaar_last4",
        "has_diabetes",
        "has_hypertension",
        "has_tb",
        "has_asthma",
        "has_heart_disease",
        "is_pregnant",
        "hospitalized_last_year",
        "regular_medicines",
        "medicines_name",
        "risk_score",
        "risk_level",
        "last_visited",
        "asha_worker_server_id",
        "date_of_birth",
        "immunization_defaulter",
        "latest_weight_for_age_z",
    },
    "households": WATERMELON_BASE
    | {
        "household_code",
        "head_of_family",
        "address",
        "village",
        "block",
        "district",
        "gps_lat",
        "gps_lng",
        "total_members",
        "male_count",
        "female_count",
        "children_under5",
        "elderly_above60",
        "has_toilet",
        "water_source",
        "is_bpl",
        "awc_number",
        "lgd_code",
        "asha_worker_id",
    },
    "survey_responses": WATERMELON_BASE
    | {
        "patient_id",
        "asha_worker_server_id",
        "survey_date",
        "visit_type",
        "asha_observation",
        "living_condition",
        "healthcare_access",
        "symptom_fever_json",
        "symptom_cough_json",
        "symptom_breathless_json",
        "symptom_chest_pain_json",
        "symptom_weakness_json",
        "symptom_diarrhea_json",
        "symptom_vomiting_json",
        "serious_severe_breathing",
        "serious_chest_pain",
        "serious_unable_walk",
        "serious_pregnancy_comp",
        "chronic_freq_urination",
        "chronic_excess_thirst",
        "chronic_joint_pain",
        "chronic_known_bp_dm",
        "comm_cough_2weeks",
        "comm_fever_3days",
        "comm_infection_wounds",
        "comm_contact_sick",
        "followup_condition",
        "followup_doctor_visited",
        "followup_treatment_started",
        "computed_risk_score",
        "computed_risk_level",
        "triggered_factors_json",
        "ml_model_version",
        "is_complete",
        "device_id",
        "synced_at",
        "consent_accepted",
        "consent_version",
    },
    "follow_ups": WATERMELON_BASE
    | {
        "patient_id",
        "survey_id",
        "due_date",
        "completed_date",
        "is_completed",
        "is_overdue",
        "follow_type",
        "outcome",
        "notes",
        "incentive_awarded",
        "visit_lat",
        "visit_lng",
        "visit_accuracy_m",
        "visit_gps_timestamp",
        "distance_from_household_m",
        "gps_verification_status",
    },
    "flags": WATERMELON_BASE
    | {
        "patient_id",
        "asha_worker_server_id",
        "flag_type",
        "severity",
        "description",
        "is_resolved",
        "resolved_at",
        "resolution_notes",
    },
    "referrals": WATERMELON_BASE
    | {
        "patient_id",
        "provider_name",
        "provider_type",
        "disease_category",
        "referral_date",
        "status",
        "outcome",
        "incentive_awarded",
    },
    "mother_records": WATERMELON_BASE
    | {
        "patient_id",
        "mcts_rch_id_mother",
        "mcts_rch_id_child",
        "mother_aadhaar_last4",
        "child_aadhaar_last4",
        "father_name",
        "lmp_date",
        "edd",
        "gravida",
        "prev_live_births",
        "is_high_risk",
        "is_pmmvy_eligible",
        "bank_name",
        "bank_account",
        "bank_ifsc",
        "postal_account",
        "identified_delivery_institution",
        "anc_visit_1_json",
        "anc_visit_2_json",
        "anc_visit_3_json",
        "anc_visit_4_json",
        "anc_visit_5_json",
        "tt_injection_1_date",
        "tt_injection_2_date",
        "ifa_tablets_issued",
        "ifa_dates_json",
        "calcium_tablets",
        "albendazole_given",
        "blood_group",
        "rh_type",
        "hiv_screening_date",
        "hiv_result",
        "syphilis_date",
        "syphilis_result",
        "delivery_date",
        "delivery_place",
        "delivery_type",
        "pregnancy_outcome",
        "birth_weight_kg",
        "child_sex",
        "child_cried_at_birth",
        "breastfed_within_1hr",
        "vit_k_given",
        "birth_registration_no",
        "pnc_day1_json",
        "pnc_day3_json",
        "pnc_day7_json",
        "pnc_week6_json",
        "jsy_registered",
        "jsy_payment_received",
        "pmmvy_installment_1",
        "pmmvy_installment_2",
        "pmmvy_installment_3",
        "sub_centre_reg_no",
        "fixed_vhsnd_day",
    },
    "anc_visit_records": WATERMELON_BASE
    | {
        "mother_record_id",
        "visit_number",
        "visit_date",
        "pog_weeks",
        "weight_kg",
        "pulse_rate",
        "bp_systolic",
        "bp_diastolic",
        "pallor",
        "oedema",
        "jaundice",
        "complaints",
        "fundal_height_cm",
        "lie_presentation",
        "fetal_movements",
        "fetal_heart_rate",
        "hemoglobin_gm",
        "urine_albumin",
        "urine_sugar",
        "ultrasonography_done",
        "gdm_screening",
        "is_under_pmsma",
    },
    "immunization_records": WATERMELON_BASE
    | {
        "patient_id",
        "mother_record_id",
        "vaccine_name",
        "vaccine_code",
        "scheduled_date",
        "administered_date",
        "is_administered",
        "is_missed",
        "missed_reason",
        "next_due_date",
        "batch_number",
        "anm_name",
        "site",
        "adverse_event",
    },
    "growth_records": WATERMELON_BASE
    | {
        "patient_id",
        "recorded_date",
        "age_months",
        "weight_kg",
        "height_cm",
        "muac_cm",
        "weight_for_age_z",
        "height_for_age_z",
        "weight_for_height_z",
        "nutrition_status",
        "recorded_by",
        "awc_number",
    },
    "child_development": WATERMELON_BASE
    | {
        "patient_id",
        "assessment_date",
        "age_months",
        "milestones_json",
        "warning_signs_json",
        "assessed_by",
        "referral_needed",
    },
    "incentive_records": WATERMELON_BASE
    | {
        "action_type",
        "patient_id",
        "reference_id",
        "points",
        "amount_inr",
        "period_date",
        "is_approved",
        "approved_at",
        "payment_received",
    },
}

# ── Django → WatermelonDB field aliases ──────────────────────
FIELD_ALIASES = {
    "patients": {
        "full_name": "name",
        "age_years": "age",
        "diabetes": "has_diabetes",
        "hypertension": "has_hypertension",
        "tb_history": "has_tb",
        "prev_hospitalized": "hospitalized_last_year",
        "pregnancy_status": "is_pregnant",
    },
    "households": {
        "head_name": "head_of_family",
        "lat": "gps_lat",
        "lng": "gps_lng",
        "member_count": "total_members",
        "is_active": None,
        "head_name_hi": None,
        "created_by": None,
        "metadata": None,
    },
    "survey_responses": {
        "patient": "patient_id",
        "survey_type": None,
        "answers": None,
        "score_snapshot": None,
        "photo_base64": None,
        "submitted_at": None,
        "synced_at": "synced_at",
        "created_by": None,
    },
    "follow_ups": {
        "patient": "patient_id",
        "worker": None,
        "scheduled_date": "due_date",
        "urgency": None,
        "triggered_by_assessment": None,
        "is_auto_scheduled": None,
        "status": "is_completed",
        "completed_at": "completed_date",
        "completion_notes": "notes",
        "incentive_claimed": "incentive_awarded",
        "visit_lat": "visit_lat",
        "visit_lng": "visit_lng",
        "visit_accuracy_m": "visit_accuracy_m",
        "visit_gps_timestamp": "visit_gps_timestamp",
        "distance_from_household_m": "distance_from_household_m",
        "gps_verification_status": "gps_verification_status",
        "created_by": None,
    },
    "flags": {
        "patient": "patient_id",
        "dedupe_key": None,
        "explanation": "description",
        "score": None,
        "source": None,
        "status": "is_resolved",
        "created_by": None,
    },
    "referrals": {
        "patient": "patient_id",
        "flag": "flag_id",
        "destination": "provider_name",
        "reason": None,
        "metadata": None,
        "created_by": None,
    },
    "mother_records": {
        "full_name": None,
        "name_hi": None,
        "phone": None,
        "gender": None,
        "date_of_birth": None,
        "relationship_to_head": None,
        "region": None,
        "district": None,
        "block": None,
        "village": None,
        "status": None,
        "asha_worker": None,
        "diabetes": None,
        "hypertension": None,
        "tb_history": None,
        "prev_hospitalized": None,
        "pregnancy_status": None,
        "prev_high_risk_count": None,
        "metadata": None,
        "created_by": None,
        "household": None,
        "mcp_card_number": None,
        "mcp_card_issued": None,
        "last_delivery_date": None,
        "last_delivery_place": None,
        "obstetric_complications": None,
        "past_medical_history": None,
        "anc_visit_count": None,
        "mother_patient": None,
        "mcts_rch_id": "mcts_rch_id_mother",
        "pmmvy_eligible": "is_pmmvy_eligible",
        "bank_account_number": "bank_account",
        "bank_ifsc": "bank_ifsc",
        "bank_branch_name": None,
        "gravida": "gravida",
        "para": None,
        "lmp_date": "lmp_date",
        "edd": "edd",
        "is_high_risk_pregnancy": "is_high_risk",
        "birth_weight_kg": "birth_weight_kg",
        "birth_place": "delivery_place",
        "birth_registration_number": "birth_registration_no",
        "patient": "patient_id",
    },
    "anc_visit_records": {
        "patient": "mother_record_id",
        "protocol": None,
        "notes": None,
        "occurred_at": None,
        "payload": None,
        "created_by": None,
    },
    "immunization_records": {
        "patient": "patient_id",
        "protocol": None,
        "notes": None,
        "occurred_at": None,
        "payload": None,
        "created_by": None,
    },
    "growth_records": {
        "patient": "patient_id",
        "protocol": None,
        "notes": None,
        "occurred_at": None,
        "payload": None,
        "created_by": None,
    },
    "child_development": {
        "patient": "patient_id",
        "protocol": None,
        "notes": None,
        "occurred_at": None,
        "payload": None,
        "created_by": None,
    },
    "incentive_records": {
        "worker": "asha_worker_server_id",
        "category": None,
        "description": None,
        "amount": None,
        "amount_paise": None,
        "activity_type": "action_type",
        "status": "is_approved",
        "reference_id": "reference_id",
        "reference_type": None,
        "approved_by": None,
        "approved_at": "approved_at",
        "paid_at": None,
        "month_year": "period_date",
        "description_en": None,
        "description_hi": None,
        "metadata": None,
    },
}

# ── FK remapping for pull: Django FK field → WatermelonDB column ──
# ── FK remapping for pull: WM column → cache key ────────────
# After _to_wm_record renames Django fields to WM column names,
# FK columns will still have integer PK values. _remap_fk converts
# those integer PKs to local_uuid strings using the cache.
PULL_FK_MAP = {
    "patients": [("household_id", "household")],
    "survey_responses": [("patient_id", "patient")],
    "flags": [("patient_id", "patient")],
    "referrals": [("patient_id", "patient"), ("flag_id", "flag")],
    "follow_ups": [("patient_id", "patient")],
    "anc_visit_records": [("mother_record_id", "patient")],
    "immunization_records": [("patient_id", "patient")],
    "growth_records": [("patient_id", "patient")],
    "child_development": [("patient_id", "patient")],
    "incentive_records": [("asha_worker_server_id", "worker")],
}

PUSH_FK_MAP = {
    "patient": {"household_id": ("household", Household)},
    "survey_response": {"patient_id": ("patient", Patient)},
    "flag": {"patient_id": ("patient", Patient)},
    "referral": {"patient_id": ("patient", Patient), "flag_id": ("flag", Flag)},
    "follow_up": {"patient_id": ("patient", Patient)},
    "care_interaction": {"patient_id": ("patient", Patient), "mother_record_id": ("patient", Patient)},
}


# ── Helpers ──────────────────────────────────────────────────


def _ms(dt):
    """Convert a datetime to a millisecond timestamp."""
    if dt is None:
        return int(time.time() * 1000)
    if isinstance(dt, str):
        try:
            dt = datetime.fromisoformat(dt.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            return int(time.time() * 1000)
    epoch = dt.timestamp()
    return int(epoch * 1000)


def payload_hash(change):
    raw = json.dumps(change, sort_keys=True, default=str).encode()
    return hashlib.sha256(raw).hexdigest()


def _fk_cache():
    """Build dicts mapping PK → local_uuid for every FK target model."""
    return {
        "patient": dict(Patient.objects.values_list("id", "local_uuid")),
        "household": dict(Household.objects.values_list("id", "local_uuid")),
        "flag": dict(Flag.objects.values_list("id", "local_uuid")),
    }


def _remap_fk(items, cache, mappings):
    """Replace integer FK PK values in WM-column records with local_uuid strings."""
    for item in items:
        for wm_column, cache_key in mappings:
            pk = item.pop(wm_column, None)
            lookup = cache.get(cache_key, {})
            if pk is not None and pk in lookup:
                item[wm_column] = str(lookup[pk])
    return items


def _to_wm_record(record, table_name):
    """Convert a Django serializer record dict to WatermelonDB-compatible format.

    * Applies FIELD_ALIASES (rename, drop, or pass-through)
    * Converts datetime fields to millisecond timestamps
    * Removes fields not in WATERMELON_COLUMNS for the table
    * Sets default values for missing required WatermelonDB fields
    """
    aliases = FIELD_ALIASES.get(table_name, {})
    allowed = WATERMELON_COLUMNS.get(table_name, set())
    result = {"id": record.get("local_uuid") or record.get("id")}

    for wm_col in allowed:
        if wm_col in ("id", "server_id", "is_synced", "is_mock", "is_deleted"):
            continue

        django_field = None
        for d_field, w_field in aliases.items():
            if w_field == wm_col:
                django_field = d_field
                break

        if django_field is None and wm_col in record:
            django_field = wm_col

        value = record.get(django_field) if django_field else None

        if value is None and django_field is None:
            for d_field, w_field in aliases.items():
                if w_field is None and d_field == wm_col:
                    break
                if w_field == wm_col:
                    break
            else:
                wm_defaults = _wm_defaults(table_name)
                if wm_col in wm_defaults:
                    result[wm_col] = wm_defaults[wm_col]
            continue

        if value is None:
            continue

        result[wm_col] = value

    result["server_id"] = str(record.get("local_uuid") or "") if record.get("local_uuid") else ""
    result["is_synced"] = True
    result["is_mock"] = False

    created_at = record.get("created_at") or record.get("createdAt")
    updated_at = record.get("updated_at") or record.get("updatedAt") or created_at
    result["created_at"] = _ms(created_at)
    result["updated_at"] = _ms(updated_at)

    return result


def _wm_defaults(table_name):
    """Provide default values for WatermelonDB fields not present in Django models."""
    defaults = {
        "patients": {
            "has_asthma": False,
            "has_heart_disease": False,
            "regular_medicines": False,
            "medicines_name": "",
            "last_visited": "",
            "asha_worker_server_id": "",
            "immunization_defaulter": False,
            "latest_weight_for_age_z": 0,
            "aadhaar_last4": "",
            "risk_score": 0,
            "risk_level": "",
            "age": 0,
            "patient_code": "",
            "household_id": "",
        },
        "survey_responses": {
            "visit_type": "",
            "asha_observation": "",
            "living_condition": "",
            "healthcare_access": "",
            "symptom_fever_json": "",
            "symptom_cough_json": "",
            "symptom_breathless_json": "",
            "symptom_chest_pain_json": "",
            "symptom_weakness_json": "",
            "symptom_diarrhea_json": "",
            "symptom_vomiting_json": "",
            "serious_severe_breathing": False,
            "serious_chest_pain": False,
            "serious_unable_walk": False,
            "serious_pregnancy_comp": False,
            "chronic_freq_urination": False,
            "chronic_excess_thirst": False,
            "chronic_joint_pain": False,
            "chronic_known_bp_dm": False,
            "comm_cough_2weeks": False,
            "comm_fever_3days": False,
            "comm_infection_wounds": False,
            "comm_contact_sick": False,
            "followup_condition": "",
            "followup_doctor_visited": False,
            "followup_treatment_started": False,
            "computed_risk_score": 0,
            "computed_risk_level": "",
            "triggered_factors_json": "",
            "ml_model_version": "",
            "is_complete": True,
            "device_id": "",
            "consent_accepted": True,
            "consent_version": "1.0",
            "patient_id": "",
            "asha_worker_server_id": "",
            "synced_at": "",
        },
        "follow_ups": {
            "patient_id": "",
            "survey_id": "",
            "is_overdue": False,
            "follow_type": "",
            "outcome": "",
            "incentive_awarded": False,
            "due_date": "",
            "completed_date": "",
            "notes": "",
            "visit_lat": None,
            "visit_lng": None,
            "visit_accuracy_m": None,
            "visit_gps_timestamp": None,
            "distance_from_household_m": None,
            "gps_verification_status": "",
        },
        "flags": {
            "patient_id": "",
            "asha_worker_server_id": "",
            "severity": "",
            "description": "",
            "is_resolved": False,
            "resolved_at": "",
            "resolution_notes": "",
        },
        "referrals": {
            "patient_id": "",
            "provider_name": "",
            "provider_type": "",
            "disease_category": "",
            "referral_date": "",
            "outcome": "",
            "incentive_awarded": False,
        },
        "households": {
            "head_of_family": "",
            "gps_lat": 0.0,
            "gps_lng": 0.0,
            "total_members": 1,
            "male_count": 0,
            "female_count": 0,
            "children_under5": 0,
            "elderly_above60": 0,
            "has_toilet": False,
            "water_source": "",
            "is_bpl": False,
            "awc_number": "",
            "lgd_code": "",
            "asha_worker_id": "",
        },
        "mother_records": {
            "patient_id": "",
            "mcts_rch_id_mother": "",
            "mcts_rch_id_child": "",
            "mother_aadhaar_last4": "",
            "child_aadhaar_last4": "",
            "father_name": "",
            "lmp_date": "",
            "edd": "",
            "gravida": "",
            "prev_live_births": "",
            "is_high_risk": False,
            "is_pmmvy_eligible": False,
            "bank_name": "",
            "bank_account": "",
            "bank_ifsc": "",
            "postal_account": "",
            "identified_delivery_institution": "",
            "anc_visit_1_json": "",
            "anc_visit_2_json": "",
            "anc_visit_3_json": "",
            "anc_visit_4_json": "",
            "anc_visit_5_json": "",
            "tt_injection_1_date": "",
            "tt_injection_2_date": "",
            "ifa_tablets_issued": "",
            "ifa_dates_json": "",
            "calcium_tablets": "",
            "albendazole_given": False,
            "blood_group": "",
            "rh_type": "",
            "hiv_screening_date": "",
            "hiv_result": "",
            "syphilis_date": "",
            "syphilis_result": "",
            "delivery_date": "",
            "delivery_place": "",
            "delivery_type": "",
            "pregnancy_outcome": "",
            "birth_weight_kg": "",
            "child_sex": "",
            "child_cried_at_birth": False,
            "breastfed_within_1hr": False,
            "vit_k_given": False,
            "birth_registration_no": "",
            "pnc_day1_json": "",
            "pnc_day3_json": "",
            "pnc_day7_json": "",
            "pnc_week6_json": "",
            "jsy_registered": False,
            "jsy_payment_received": False,
            "pmmvy_installment_1": False,
            "pmmvy_installment_2": False,
            "pmmvy_installment_3": False,
            "sub_centre_reg_no": "",
            "fixed_vhsnd_day": "",
        },
        "anc_visit_records": {"mother_record_id": ""},
        "immunization_records": {"patient_id": "", "mother_record_id": ""},
        "growth_records": {"patient_id": ""},
        "child_development": {"patient_id": ""},
        "incentive_records": {"patient_id": "", "reference_id": ""},
    }
    return defaults.get(table_name, {})


def resolve_fk(data, model_name):
    """Replace WatermelonDB FK field names with Django model instances."""
    fk_map = PUSH_FK_MAP.get(model_name, {})
    result = data.copy()
    for wm_field, (django_field, model_class) in fk_map.items():
        val = result.pop(wm_field, None)
        if val:
            try:
                qs = model_class.objects.all()
                if model_class is Patient:
                    qs = qs.select_related("household")
                result[django_field] = qs.get(local_uuid=val)
            except model_class.DoesNotExist:
                result.pop(django_field, None)
                logger.warning("sync_push_fk_not_found model=%s fk=%s uuid=%s", model_name, django_field, val)
    return result


def verify_patient_access(patient_obj, user):
    """Return True if user has geography access to this patient."""
    qs = for_user_geography(Patient.objects.filter(pk=patient_obj.pk), user)
    return qs.exists()


def geo_guard_patient(user):
    """Return a Patient queryset scoped to the user's geography."""
    return for_user_geography(Patient.objects.all(), user)


# ── Pull helpers ─────────────────────────────────────────────


def _queryset_for_table(table_name, patient_ids, since):
    """Return a queryset for the given WatermelonDB table name, scoped to patient_ids."""
    if table_name == "patients":
        qs = Patient.objects.filter(id__in=patient_ids).select_related("household").order_by("updated_at")
        return qs, "patient"
    if table_name == "households":
        hh_ids = set(Patient.objects.filter(id__in=patient_ids).values_list("household_id", flat=True).distinct())
        qs = Household.objects.filter(id__in=hh_ids, is_active=True).order_by("updated_at")
        return qs, "household"
    if table_name == "survey_responses":
        qs = SurveyResponse.objects.filter(patient_id__in=patient_ids).select_related("patient").order_by("updated_at")
        return qs, "survey_response"
    if table_name == "follow_ups":
        qs = FollowUp.objects.filter(patient_id__in=patient_ids).order_by("updated_at")
        return qs, "follow_up"
    if table_name == "flags":
        qs = Flag.objects.filter(patient_id__in=patient_ids).order_by("updated_at")
        return qs, "flag"
    if table_name == "referrals":
        qs = Referral.objects.filter(patient_id__in=patient_ids).select_related("flag").order_by("updated_at")
        return qs, "referral"
    if table_name == "mother_records":
        qs = (
            Patient.objects.select_related("household", "asha_worker", "mother_patient", "created_by")
            .filter(id__in=patient_ids)
            .order_by("updated_at")
        )
        return qs, "patient"
    if table_name in ("immunization_records", "growth_records", "anc_visit_records", "child_development"):
        qs = CareInteraction.objects.filter(patient_id__in=patient_ids, protocol=table_name).order_by("updated_at")
        return qs, "care_interaction"
    if table_name == "incentive_records":
        qs = IncentiveLedgerEntry.objects.filter(worker__isnull=False).order_by("-created_at")
        return qs, "incentive_ledger_entry"
    return None, None


def _serialize_records(queryset, table_name, fk_cache=None):
    """Serialize a queryset into WatermelonDB-compatible records."""
    records = []
    for obj in queryset:
        if table_name == "patients":
            data = PatientSerializer(obj).data
        elif table_name == "households":
            data = HouseholdSerializer(obj).data
        elif table_name == "survey_responses":
            data = SurveyResponseSerializer(obj).data
        elif table_name == "follow_ups":
            data = {
                "local_uuid": str(obj.local_uuid),
                "patient": obj.patient_id,
                "scheduled_date": obj.scheduled_date.isoformat() if obj.scheduled_date else None,
                "status": "completed" if obj.status == FollowUp.Status.COMPLETED else "pending",
                "completed_at": obj.completed_at.isoformat() if obj.completed_at else None,
                "completion_notes": obj.completion_notes,
                "urgency": obj.urgency,
                "incentive_claimed": obj.incentive_claimed,
                "visit_lat": obj.visit_lat,
                "visit_lng": obj.visit_lng,
                "visit_accuracy_m": obj.visit_accuracy_m,
                "visit_gps_timestamp": obj.visit_gps_timestamp.isoformat() if obj.visit_gps_timestamp else None,
                "distance_from_household_m": obj.distance_from_household_m,
                "gps_verification_status": obj.gps_verification_status,
                "created_at": obj.created_at.isoformat() if obj.created_at else None,
                "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
            }
        elif table_name == "flags":
            data = {
                "local_uuid": str(obj.local_uuid),
                "patient": obj.patient_id,
                "flag_type": obj.flag_type,
                "explanation": obj.explanation if isinstance(obj.explanation, str) else json.dumps(obj.explanation),
                "status": "resolved" if obj.status == Flag.Status.RESOLVED else "open",
                "created_at": obj.created_at.isoformat() if obj.created_at else None,
                "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
            }
        elif table_name == "referrals":
            data = {
                "local_uuid": str(obj.local_uuid),
                "patient": obj.patient_id,
                "flag": obj.flag_id,
                "destination": obj.destination,
                "status": obj.status,
                "created_at": obj.created_at.isoformat() if obj.created_at else None,
                "updated_at": obj.updated_at.isoformat() if obj.updated_at else None,
            }
        elif table_name == "mother_records":
            data = PatientSerializer(obj).data
            data["patient_id"] = str(obj.local_uuid)
        elif table_name in ("immunization_records", "growth_records", "anc_visit_records", "child_development"):
            data = {
                "local_uuid": str(obj.local_uuid),
                "patient": obj.patient_id,
            }
            if obj.payload:
                payload = obj.payload if isinstance(obj.payload, dict) else json.loads(obj.payload)
                data.update(payload)
            data["created_at"] = obj.created_at.isoformat() if obj.created_at else None
            data["updated_at"] = obj.updated_at.isoformat() if obj.updated_at else None
        elif table_name == "incentive_records":
            data = {
                "local_uuid": str(obj.local_uuid),
                "worker": obj.worker_id,
                "activity_type": obj.activity_type,
                "amount_paise": obj.amount_paise,
                "status": obj.status,
                "reference_id": str(obj.reference_id) if obj.reference_id else None,
                "month_year": obj.month_year,
                "created_at": obj.created_at.isoformat() if obj.created_at else None,
            }
        else:
            continue

        wm_record = _to_wm_record(data, table_name)

        if fk_cache and table_name in PULL_FK_MAP:
            _remap_fk([wm_record], fk_cache, PULL_FK_MAP[table_name])

        records.append(wm_record)

    return records


def _deleted_since(table_name, since):
    """Return list of local_uuids deleted since the given timestamp.

    Uses SyncEvent records to track hard deletes.
    For Household, also checks is_active=False.
    """
    deleted_uuids = set()

    model_name = TABLE_TO_MODEL.get(table_name)
    if not model_name:
        return []

    sync_events = SyncEvent.objects.filter(
        model_name=model_name,
        event_type="delete",
        status=SyncEvent.Status.APPLIED,
    )
    if since:
        sync_events = sync_events.filter(received_at__gt=since)
    for event in sync_events:
        deleted_uuids.add(event.object_local_uuid)

    if table_name == "households":
        inactive = Household.objects.filter(is_active=False)
        if since:
            inactive = inactive.filter(updated_at__gt=since)
        for hh in inactive:
            deleted_uuids.add(str(hh.local_uuid))

    return list(deleted_uuids)


def serialize_changes(table_name, patient_ids, since, fk_cache=None):
    """Build a WatermelonDB changeset for a single table."""
    queryset, _ = _queryset_for_table(table_name, patient_ids, since)
    if queryset is None:
        return {"created": [], "updated": [], "deleted": []}

    model_has_updated_at = hasattr(queryset.model, "updated_at")

    if since:
        if hasattr(since, "tzinfo") and since.tzinfo is None:
            since = tz.make_aware(since)

        created_qs = queryset.filter(created_at__gt=since)
        if model_has_updated_at:
            updated_qs = queryset.filter(updated_at__gt=since, created_at__lte=since)
        else:
            updated_qs = queryset.none()
    else:
        created_qs = queryset
        updated_qs = queryset.none()

    created = _serialize_records(created_qs, table_name, fk_cache)
    updated = _serialize_records(updated_qs, table_name, fk_cache)
    deleted = _deleted_since(table_name, since)

    return {"created": created, "updated": updated, "deleted": deleted}


# ── Upserters & Deleters ─────────────────────────────────────


def upsert_patient(local_uuid, data, user):
    allowed_fields = {f.name for f in Patient._meta.fields}
    defaults = {}
    for k, v in data.items():
        if k in {"id", "created_at", "updated_at"}:
            continue
        if k in allowed_fields:
            defaults[k] = v
        elif k == "asha_worker_server_id" and v is not None:
            defaults["asha_worker_id"] = v
    obj, _ = Patient.objects.update_or_create(local_uuid=local_uuid, defaults=defaults)
    if not obj.created_by_id and user.is_authenticated:
        obj.created_by = user
        obj.save(update_fields=["created_by"])
    return obj


def delete_patient(local_uuid, user):
    qs = geo_guard_patient(user).filter(local_uuid=local_uuid)
    return qs.delete()[0] > 0


def upsert_household(local_uuid, data, user):
    defaults = {
        k: v
        for k, v in data.items()
        if k in {f.name for f in Household._meta.fields} and k not in {"id", "created_at", "updated_at"}
    }
    obj, _ = Household.objects.update_or_create(local_uuid=local_uuid, defaults=defaults)
    if not obj.created_by_id and user.is_authenticated:
        obj.created_by = user
        obj.save(update_fields=["created_by"])
    return obj


def delete_household(local_uuid, user):
    qs = Household.objects.filter(local_uuid=local_uuid)
    n = qs.update(is_active=False)
    return n > 0


def _parse_dt(value):
    """Parse a datetime from an ISO string or return the value as-is."""
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            pass
    return value


def upsert_survey_response(local_uuid, data, user):
    patient = data.get("patient")
    if not verify_patient_access(patient, user):
        raise PermissionError("No access to patient")
    defaults = {
        "patient": patient,
        "survey_type": data.get("survey_type", "pilot"),
        "answers": data.get("answers", {}),
        "score_snapshot": data.get("score_snapshot", {}),
        "synced_at": tz.now(),
    }
    submitted = data.get("submitted_at")
    if submitted:
        defaults["submitted_at"] = _parse_dt(submitted)
    obj, created = SurveyResponse.objects.update_or_create(local_uuid=local_uuid, defaults=defaults)
    if not obj.created_by_id and user.is_authenticated:
        obj.created_by = user
        obj.save(update_fields=["created_by"])
    surveyed_iso = obj.submitted_at.isoformat() if obj.submitted_at else None
    enqueue_risk_assessment(obj.patient_id, obj.id, surveyed_iso)
    return obj, created


def delete_survey_response(local_uuid, user):
    sr = SurveyResponse.objects.filter(local_uuid=local_uuid).select_related("patient").first()
    if sr and verify_patient_access(sr.patient, user):
        sr.delete()
        return True
    return False


def upsert_flag(local_uuid, data, user):
    patient = data.get("patient")
    if not verify_patient_access(patient, user):
        raise PermissionError("No access to patient")
    source = data.get("source", "sync")
    flag_type = data.get("flag_type", "clinical_risk")
    defaults = {
        "local_uuid": local_uuid,
        "patient": patient,
        "flag_type": flag_type,
        "source": source,
        "severity": data.get("severity", "medium"),
        "status": data.get("status", Flag.Status.OPEN),
        "score": data.get("score", 0),
        "explanation": data.get("explanation", {}),
        "created_by": user if user.is_authenticated else None,
    }
    key = data.get("dedupe_key") or dedupe_key(patient, flag_type, source)
    flag, _ = Flag.objects.update_or_create(dedupe_key=key, defaults=defaults)
    return flag


def delete_flag(local_uuid, user):
    flag = Flag.objects.filter(local_uuid=local_uuid).select_related("patient").first()
    if flag and verify_patient_access(flag.patient, user):
        flag.delete()
        return True
    return False


def upsert_referral(local_uuid, data, user):
    patient = data.get("patient")
    if not verify_patient_access(patient, user):
        raise PermissionError("No access to patient")
    defaults = {
        "patient": patient,
        "destination": data.get("destination", ""),
        "reason": data.get("reason", ""),
        "status": data.get("status", Referral.Status.DRAFT),
        "metadata": data.get("metadata", {}),
        "created_by": user if user.is_authenticated else None,
    }
    flag_obj = data.get("flag")
    if flag_obj:
        defaults["flag"] = flag_obj
    obj, _ = Referral.objects.update_or_create(local_uuid=local_uuid, defaults=defaults)
    return obj


def delete_referral(local_uuid, user):
    ref = Referral.objects.filter(local_uuid=local_uuid).select_related("patient").first()
    if ref and verify_patient_access(ref.patient, user):
        ref.delete()
        return True
    return False


def upsert_follow_up(local_uuid, data, user):
    patient = data.get("patient")
    if not verify_patient_access(patient, user):
        raise PermissionError("No access to patient")

    visit_lat = data.get("visit_lat")
    visit_lng = data.get("visit_lng")
    visit_accuracy_m = data.get("visit_accuracy_m")

    defaults = {
        "patient": patient,
        "worker": user if user.is_authenticated else None,
        "scheduled_date": data.get("due_date") or data.get("scheduled_date", tz.localdate()),
        "urgency": data.get("urgency", "routine"),
        "status": data.get("status", FollowUp.Status.PENDING),
        "completion_notes": data.get("notes") or data.get("completion_notes", ""),
        "triggered_by_assessment": None,
        "visit_lat": visit_lat,
        "visit_lng": visit_lng,
        "visit_accuracy_m": visit_accuracy_m,
        "visit_gps_timestamp": data.get("visit_gps_timestamp"),
    }

    # Server-authoritative GPS verification
    if visit_lat is not None and visit_lng is not None and patient is not None:
        household = patient.household
        household_lat = household.lat if household else None
        household_lng = household.lng if household else None
        result = classify_gps_visit(visit_lat, visit_lng, household_lat, household_lng, visit_accuracy_m or 0.0)
        defaults["distance_from_household_m"] = result["distance_m"]
        defaults["gps_verification_status"] = result["status"]
    else:
        defaults["distance_from_household_m"] = None
        defaults["gps_verification_status"] = FollowUp.GpsStatus.NOT_CAPTURED

    if data.get("completed_date") or data.get("completed_at"):
        defaults["completed_at"] = data.get("completed_date") or data["completed_at"]
    obj, _ = FollowUp.objects.update_or_create(local_uuid=local_uuid, defaults=defaults)
    return obj


def delete_follow_up(local_uuid, user):
    fu = FollowUp.objects.filter(local_uuid=local_uuid).select_related("patient").first()
    if fu and verify_patient_access(fu.patient, user):
        fu.delete()
        return True
    return False


def upsert_care_interaction(local_uuid, data, user):
    patient = data.get("patient")
    if not verify_patient_access(patient, user):
        raise PermissionError("No access to patient")
    defaults = {
        "patient": patient,
        "protocol": (data.get("protocol") or data.get("vaccine_code") or data.get("vaccine_name", "")),
        "notes": data.get("notes", ""),
        "payload": (data.get("payload") or data.get("milestones_json") or data.get("warning_signs_json") or {}),
        "created_by": user if user.is_authenticated else None,
    }
    obj, _ = CareInteraction.objects.update_or_create(local_uuid=local_uuid, defaults=defaults)
    return obj


def delete_care_interaction(local_uuid, user):
    ci = CareInteraction.objects.filter(local_uuid=local_uuid).select_related("patient").first()
    if ci and verify_patient_access(ci.patient, user):
        ci.delete()
        return True
    return False


def upsert_incentive(local_uuid, data, user):
    defaults = {
        "worker": user if user.is_authenticated else None,
        "activity_type": data.get("activity_type") or data.get("action_type", "survey_completion"),
        "amount_paise": data.get("amount_paise") or (data.get("points", 0) * 100),
        "status": data.get("status", "pending"),
        "metadata": data.get("metadata", {}),
    }
    if data.get("month_year"):
        defaults["month_year"] = data["month_year"]
    elif data.get("period_date"):
        defaults["month_year"] = data["period_date"][:7]
    obj, _ = IncentiveLedgerEntry.objects.update_or_create(local_uuid=local_uuid, defaults=defaults)
    return obj


def delete_incentive(local_uuid, user):
    return IncentiveLedgerEntry.objects.filter(local_uuid=local_uuid).delete()[0] > 0


UPSERTS = {
    "patient": upsert_patient,
    "household": upsert_household,
    "survey_response": upsert_survey_response,
    "flag": upsert_flag,
    "referral": upsert_referral,
    "follow_up": upsert_follow_up,
    "care_interaction": upsert_care_interaction,
    "incentive_ledger_entry": upsert_incentive,
}

DELETES = {
    "patient": delete_patient,
    "household": delete_household,
    "survey_response": delete_survey_response,
    "flag": delete_flag,
    "referral": delete_referral,
    "follow_up": delete_follow_up,
    "care_interaction": delete_care_interaction,
    "incentive_ledger_entry": delete_incentive,
}

PULL_TABLES = [
    "patients",
    "households",
    "survey_responses",
    "follow_ups",
    "flags",
    "referrals",
    "mother_records",
    "immunization_records",
    "growth_records",
    "incentive_records",
    "anc_visit_records",
    "child_development",
]


# ── Pull view ────────────────────────────────────────────────


class SyncPullView(APIView):
    def get(self, request):
        last_pulled_at = request.query_params.get("last_pulled_at")
        since = None
        if last_pulled_at and last_pulled_at != "0":
            try:
                since = datetime.fromtimestamp(int(last_pulled_at) / 1000.0)
            except (ValueError, OSError):
                since = None

        patients = geo_guard_patient(request.user).select_related("household").order_by("updated_at")
        patient_ids = list(patients.values_list("id", flat=True))
        cache = _fk_cache()

        changes = {}
        for table in PULL_TABLES:
            changes[table] = serialize_changes(table, patient_ids, since, fk_cache=cache)

        return Response({"changes": changes, "timestamp": int(time.time() * 1000)})


# ── Push view ────────────────────────────────────────────────


class SyncPushView(APIView):
    throttle_classes = [SyncPushThrottle]

    @transaction.atomic
    def post(self, request):
        device_id = request.data.get("device_id", "unknown")
        wm_changes = request.data.get("changes", {})

        logger.info("sync_push_start device_id=%s tables=%s", device_id, list(wm_changes.keys()))

        # Flatten WatermelonDB changes into a list of operations
        flat_changes = []
        for table_name, ops in wm_changes.items():
            model_name = TABLE_TO_MODEL.get(table_name)
            if not model_name:
                logger.debug("sync_push_skip_table table=%s", table_name)
                continue
            for op in ("created", "updated"):
                for record in ops.get(op, []):
                    flat_changes.append(
                        {
                            "event_uuid": record.get("event_uuid"),
                            "model": model_name,
                            "local_uuid": record.get("id"),
                            "deleted": False,
                            "data": record,
                        }
                    )
            for local_uuid in ops.get("deleted", []):
                flat_changes.append(
                    {
                        "model": model_name,
                        "local_uuid": local_uuid,
                        "deleted": True,
                        "data": {},
                    }
                )

        # Validate and deduplicate
        serializer = SyncPushSerializer(data={"changes": flat_changes, "client_id": device_id})
        serializer.is_valid(raise_exception=True)
        client_id = serializer.validated_data["client_id"]
        results = []
        survey_upserted = False

        for change in serializer.validated_data["changes"]:
            event_uuid = change.get("event_uuid")
            local_uuid = str(change["local_uuid"])

            # Deterministic dedup key when no event_uuid is provided
            dedup_uuid = event_uuid or uuid.uuid5(
                uuid.NAMESPACE_DNS,
                f"sync:{change['model']}:{local_uuid}:{'del' if change['deleted'] else 'up'}",
            )

            event_defaults = {
                "client_id": client_id,
                "event_type": "delete" if change["deleted"] else "upsert",
                "model_name": change["model"],
                "object_local_uuid": local_uuid,
                "payload_hash": payload_hash(change),
                "actor": request.user if request.user.is_authenticated else None,
            }
            if event_uuid:
                event_defaults["local_uuid"] = event_uuid

            event, event_created = SyncEvent.objects.get_or_create(
                local_uuid=dedup_uuid,
                defaults=event_defaults,
            )
            if not event_created:
                results.append(
                    {
                        "event_uuid": str(event.local_uuid),
                        "status": SyncEvent.Status.DUPLICATE,
                        "model": change["model"],
                        "local_uuid": local_uuid,
                    }
                )
                continue

            # Process the change
            try:
                if change["deleted"]:
                    delete_fn = DELETES.get(change["model"])
                    if delete_fn:
                        delete_fn(local_uuid, request.user)
                    event.status = SyncEvent.Status.APPLIED
                    event.save(update_fields=["status"])
                else:
                    # Resolve FK references before upsert
                    resolved_data = resolve_fk(change.get("data", {}), change["model"])
                    upsert_fn = UPSERTS.get(change["model"])
                    if not upsert_fn:
                        logger.warning("sync_push_no_upserter model=%s", change["model"])
                        event.status = SyncEvent.Status.ERROR
                        event.message = f"No handler for {change['model']}"
                        event.save(update_fields=["status", "message"])
                        results.append(
                            {
                                "event_uuid": str(event.local_uuid),
                                "status": event.status,
                                "model": change["model"],
                                "local_uuid": local_uuid,
                                "message": event.message,
                            }
                        )
                        continue

                    upsert_fn(local_uuid, resolved_data, request.user)
                    if change["model"] == "survey_response":
                        survey_upserted = True
                    event.status = SyncEvent.Status.APPLIED
                    event.save(update_fields=["status"])

                results.append(
                    {
                        "event_uuid": str(event.local_uuid),
                        "status": SyncEvent.Status.APPLIED,
                        "model": change["model"],
                        "local_uuid": local_uuid,
                    }
                )

            except PermissionError as exc:
                event.status = SyncEvent.Status.ERROR
                event.message = str(exc)
                event.save(update_fields=["status", "message"])
                logger.warning("sync_push_permission_denied model=%s local_uuid=%s", change["model"], local_uuid)
                results.append(
                    {
                        "event_uuid": str(event.local_uuid),
                        "status": event.status,
                        "model": change["model"],
                        "local_uuid": local_uuid,
                        "message": event.message,
                    }
                )

            except Patient.DoesNotExist:
                event.status = SyncEvent.Status.ERROR
                event.message = "Referenced patient not found"
                event.save(update_fields=["status", "message"])
                logger.warning("sync_push_patient_not_found model=%s local_uuid=%s", change["model"], local_uuid)
                results.append(
                    {
                        "event_uuid": str(event.local_uuid),
                        "status": event.status,
                        "model": change["model"],
                        "local_uuid": local_uuid,
                        "message": event.message,
                    }
                )

            except (KeyError, ValueError, TypeError) as exc:
                event.status = SyncEvent.Status.ERROR
                event.message = f"Invalid data: {exc}"
                event.save(update_fields=["status", "message"])
                logger.warning(
                    "sync_push_invalid_data model=%s local_uuid=%s error=%s", change["model"], local_uuid, exc
                )
                results.append(
                    {
                        "event_uuid": str(event.local_uuid),
                        "status": event.status,
                        "model": change["model"],
                        "local_uuid": local_uuid,
                        "message": event.message,
                    }
                )

            except IntegrityError:
                event.status = SyncEvent.Status.ERROR
                event.message = "Database integrity error"
                event.save(update_fields=["status", "message"])
                logger.warning("sync_push_integrity_error model=%s local_uuid=%s", change["model"], local_uuid)
                results.append(
                    {
                        "event_uuid": str(event.local_uuid),
                        "status": event.status,
                        "model": change["model"],
                        "local_uuid": local_uuid,
                        "message": event.message,
                    }
                )

            except Exception:
                logger.exception("sync_push_unexpected_error model=%s local_uuid=%s", change["model"], local_uuid)
                event.status = SyncEvent.Status.ERROR
                event.message = "Internal server error"
                event.save(update_fields=["status", "message"])
                results.append(
                    {
                        "event_uuid": str(event.local_uuid),
                        "status": event.status,
                        "model": change["model"],
                        "local_uuid": local_uuid,
                        "message": event.message,
                    }
                )
                raise  # Re-raise to roll back the transaction

        logger.info(
            "sync_push_done device_id=%s change_count=%d survey_upserted=%s",
            device_id,
            len(flat_changes),
            survey_upserted,
        )

        response_payload = {"results": results, "status": "synced"}
        if survey_upserted:
            response_payload["risk_assessment"] = "processing"
        return Response(response_payload, status=status.HTTP_200_OK)
