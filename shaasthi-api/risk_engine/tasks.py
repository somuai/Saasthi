"""Celery tasks for background risk assessment."""

from __future__ import annotations

import logging
from datetime import datetime

from celery import shared_task
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from flagging.services import create_flags_for_assessment
from registry.models import Patient
from surveys.models import SurveyResponse

from .engine import RiskEngine

logger = logging.getLogger(__name__)


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    name="risk_engine.run_risk_assessment",
    rate_limit="100/s",
)
def run_risk_assessment(self, patient_id, survey_response_id=None, surveyed_at=None):
    """
    Run risk assessment after survey sync (fire-and-forget).
    patient_id: Patient.pk (int) or local_uuid string.
    """
    try:
        if isinstance(patient_id, str) and "-" in patient_id:
            patient = Patient.objects.get(local_uuid=patient_id)
        else:
            patient = Patient.objects.get(pk=patient_id)

        survey = None
        if survey_response_id:
            if isinstance(survey_response_id, str) and "-" in survey_response_id:
                survey = SurveyResponse.objects.get(local_uuid=survey_response_id)
            else:
                survey = SurveyResponse.objects.get(pk=survey_response_id)

        surveyed_at_dt = None
        if surveyed_at:
            if isinstance(surveyed_at, datetime):
                surveyed_at_dt = surveyed_at
            else:
                surveyed_at_dt = parse_datetime(surveyed_at)
                if surveyed_at_dt and timezone.is_naive(surveyed_at_dt):
                    surveyed_at_dt = timezone.make_aware(surveyed_at_dt)

        engine = RiskEngine()
        assessment = engine.create_assessment(patient, survey, surveyed_at=surveyed_at_dt)
        create_flags_for_assessment(assessment)

        # Auto-schedule follow-ups for medium/high/critical assessments
        if assessment.level in ("medium", "high"):
            try:
                from flagging.services import auto_schedule_followups
                auto_schedule_followups(assessment)
            except Exception:
                logger.warning("auto_schedule_followups skipped", exc_info=True)

        # Chain Gemma 4 enhancement for medium+ risk (low keeps template recommendations)
        if assessment.level in ("medium", "high"):
            try:
                enhance_with_gemma4.delay(str(assessment.local_uuid))
            except Exception:
                logger.warning("enhance_with_gemma4 enqueue skipped (broker unavailable)", exc_info=True)

        return {
            "status": "completed",
            "assessment_id": str(assessment.local_uuid),
            "risk_level": assessment.level,
            "normalized_score": assessment.normalized_score,
        }
    except (Patient.DoesNotExist, SurveyResponse.DoesNotExist) as exc:
        logger.warning("run_risk_assessment skipped: %s", exc)
        return {"status": "skipped", "reason": "patient_or_survey_not_found"}
    except Exception as exc:
        logger.exception("run_risk_assessment failed")
        raise self.retry(exc=exc) from exc


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    name="risk_engine.enhance_with_gemma4",
)
def enhance_with_gemma4(self, assessment_id, photo_base64=None):
    """
    Background Celery task to enhance a RiskAssessment's recommendation
    using Gemma 4 LLM.
    """
    from .models import RiskAssessment
    from .gemma_service import gemma_service

    try:
        if isinstance(assessment_id, str) and "-" in assessment_id:
            assessment = RiskAssessment.objects.get(local_uuid=assessment_id)
        else:
            assessment = RiskAssessment.objects.get(pk=assessment_id)

        patient = assessment.patient
        patient_context = {
            "name": patient.full_name,
            "age": patient.age_years or (timezone.now().year - patient.date_of_birth.year if patient.date_of_birth else "N/A"),
            "village": patient.village,
        }

        # Build clean dict representation of assessment for prompt building
        assessment_dict = {
            "level": assessment.level,
            "explanations": assessment.explanations,
        }

        result = gemma_service.generate(patient_context, assessment_dict, photo_base64)
        if result:
            assessment.recommended_action_en = result["english"]
            assessment.recommended_action_hi = result["hindi"]
            assessment.recommendation_source = "gemma4_api"
            assessment.save(update_fields=["recommended_action_en", "recommended_action_hi", "recommendation_source"])
            
            logger.info("Risk assessment %s enhanced with Gemma 4 recommendation.", assessment_id)
            return {
                "status": "enhanced",
                "assessment_id": str(assessment.local_uuid),
                "model": result.get("model"),
                "source": result.get("source"),
            }
        else:
            logger.warning("Gemma 4 generation failed or validation failed. Keeping template-based fallback.")
            return {
                "status": "fallback_kept",
                "assessment_id": str(assessment.local_uuid),
                "reason": "validation_or_api_error",
            }
    except RiskAssessment.DoesNotExist as exc:
        logger.warning("enhance_with_gemma4 skipped: RiskAssessment %s not found", assessment_id)
        return {"status": "skipped", "reason": "assessment_not_found"}
    except Exception as exc:
        logger.exception("enhance_with_gemma4 task failed")
        raise self.retry(exc=exc) from exc


# ── MCP Population-Specific Risk Assessment ──────────────────────────────

_MCP_INSTANCE_MODELS: dict = {}


def _get_instance(instance_local_uuid: str, instance_model: str):
    model_map = {}
    if not _MCP_INSTANCE_MODELS:
        try:
            from mcp.models import ANCVisit, DeliveryRecord, GrowthRecord, ImmunizationRecord, PNCVisit
            _MCP_INSTANCE_MODELS.update(
                ancvisit=ANCVisit, deliveryrecord=DeliveryRecord, pncvisit=PNCVisit,
                growthrecord=GrowthRecord, immunizationrecord=ImmunizationRecord,
            )
        except ImportError:
            pass
    model_map.update(_MCP_INSTANCE_MODELS)
    model = model_map.get(instance_model.lower())
    if model is None:
        return None
    try:
        return model.objects.get(local_uuid=instance_local_uuid)
    except (model.DoesNotExist, ValueError):
        return None


@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    name="risk_engine.run_mcp_risk_assessment",
)
def run_mcp_risk_assessment(self, patient_local_uuid, instance_local_uuid="", instance_model="",
                            population="general", session_type=""):
    """
    Run risk assessment for MCP maternal/child populations.
    Uses MCPFeatureExtractor and population-specific risk rules.
    """
    from .engine import RiskEngine
    from .mcp_feature_extractor import MCPFeatureExtractor

    try:
        patient = Patient.objects.get(local_uuid=patient_local_uuid)
        instance = _get_instance(instance_local_uuid, instance_model) if instance_local_uuid else None
        surveyed_at = timezone.now()

        engine = RiskEngine()
        assessment = engine.create_assessment(
            patient, survey=None, surveyed_at=surveyed_at, save=False,
        )
        assessment.patient_population = population
        assessment.mcp_session_type = session_type

        if population == "maternal":
            latest_anc = None
            if hasattr(patient, 'anc_visits'):
                latest_anc = patient.anc_visits.order_by("-visit_date").first()
            extractor = MCPFeatureExtractor()
            features = extractor.extract_maternal(patient, latest_anc)
            assessment.ml_score = float(features[8]) if hasattr(assessment, 'apply_ml_score') else None
        elif population == "child":
            latest_growth = None
            if hasattr(patient, 'growth_records'):
                latest_growth = patient.growth_records.order_by("-recorded_date").first()
            missed_vaccines = 0
            if hasattr(patient, 'immunizations'):
                missed_vaccines = patient.immunizations.filter(status="missed").count()
            extractor = MCPFeatureExtractor()
            features = extractor.extract_child(patient, latest_growth, missed_vaccines)
            assessment.ml_score = float(features[30]) if hasattr(assessment, 'apply_ml_score') else None

        assessment.save()
        create_flags_for_assessment(assessment)

        if assessment.level in ("medium", "high"):
            try:
                auto_schedule_followups(assessment)
            except Exception:
                logger.warning("auto_schedule_followups skipped for MCP task", exc_info=True)

        if assessment.level in ("medium", "high"):
            try:
                enhance_with_gemma4.delay(str(assessment.local_uuid))
            except Exception:
                logger.warning("enhance_with_gemma4 enqueue skipped for MCP task", exc_info=True)

        return {
            "status": "completed",
            "assessment_id": str(assessment.local_uuid),
            "risk_level": assessment.level,
            "population": population,
        }
    except Patient.DoesNotExist as exc:
        logger.warning("run_mcp_risk_assessment skipped: patient %s not found", patient_local_uuid)
        return {"status": "skipped", "reason": "patient_not_found"}
    except Exception as exc:
        logger.exception("run_mcp_risk_assessment failed")
        raise self.retry(exc=exc) from exc
