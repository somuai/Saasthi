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
