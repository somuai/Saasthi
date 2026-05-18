from celery import shared_task

from apps.flagging.engine import FlaggingEngine
from apps.patients.models import Patient, SurveyResponse
from apps.risk_engine.scorer import score_patient_dict
from apps.sync_api.registry import now_ms


@shared_task
def ping():
    return "ok"


@shared_task
def run_flagging_engine():
    return FlaggingEngine().run_all_rules()


@shared_task
def rescore_all_patients():
    updated = 0
    for patient in Patient.objects.filter(is_deleted=False)[:2000]:
        survey = (
            SurveyResponse.objects.filter(patient_id=patient.id, is_deleted=False)
            .order_by("-updated_at")
            .first()
        )
        payload = survey.payload_json if survey and isinstance(survey.payload_json, dict) else None
        result = score_patient_dict(
            {
                "is_pregnant": patient.is_pregnant,
                "has_diabetes": getattr(patient, "has_diabetes", False),
                "has_hypertension": getattr(patient, "has_hypertension", False),
            },
            payload,
        )
        if patient.risk_score != result["score"] or patient.risk_level != result["risk_level"]:
            patient.risk_score = result["score"]
            patient.risk_level = result["risk_level"]
            patient.updated_at = now_ms()
            patient.save(update_fields=["risk_score", "risk_level", "updated_at"])
            updated += 1
    return {"updated": updated}


@shared_task
def rollup_incentives():
    return {"status": "scheduled", "note": "aggregate incentive_records by worker/month"}


@shared_task
def immunization_defaulters():
    return {"status": "scheduled", "note": "flag overdue immunization_records"}
