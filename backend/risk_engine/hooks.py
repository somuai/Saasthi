"""Shared hooks for enqueueing background risk assessment."""

from __future__ import annotations

import logging

from django.db import transaction

logger = logging.getLogger(__name__)


def enqueue_risk_assessment(patient_id, survey_id=None, surveyed_at_iso=None):
    """Fire-and-forget Celery task after survey is persisted."""
    try:
        from risk_engine.tasks import run_risk_assessment

        transaction.on_commit(lambda: run_risk_assessment.delay(patient_id, survey_id, surveyed_at_iso))
    except Exception:
        logger.warning("risk assessment enqueue skipped (broker unavailable)", exc_info=True)
