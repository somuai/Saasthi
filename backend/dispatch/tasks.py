"""Celery tasks for the dispatch app — emergency queue."""

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, name="dispatch.dispatch_emergency", max_retries=3, default_retry_delay=10)
def dispatch_emergency_task(self, patient_lat, patient_lng, severity, household_id, **kwargs):
    """
    Core dispatch task — runs on the dedicated 'emergency' Celery queue.

    Uber equivalent: async ride-matching job triggered by a ride request.
    """
    try:
        from dispatch.matching import dispatch_emergency

        result = dispatch_emergency(
            patient_lat=patient_lat,
            patient_lng=patient_lng,
            severity=severity,
            household_id=household_id,
            triggered_by=kwargs.get("triggered_by", "risk_engine"),
            is_delayed=kwargs.get("is_delayed", False),
            offline_duration_minutes=kwargs.get("offline_duration_minutes", 0),
        )
        if result and result.assigned_worker_id:
            logger.info(
                "Emergency dispatched: household=%s → worker=%s (dispatch #%s)",
                household_id,
                result.assigned_worker_id,
                result.pk,
            )
        elif result:
            logger.warning(
                "Emergency escalated: household=%s — no workers available (dispatch #%s)",
                household_id,
                result.pk,
            )
        return result.pk if result else None
    except Exception as exc:
        logger.exception("Dispatch failed for household=%s", household_id)
        self.retry(exc=exc)


@shared_task(name="dispatch.escalate_to_supervisor")
def escalate_to_supervisor(household_id, severity="HIGH", offline_duration_minutes=0):
    """Escalate an unhandled emergency to the block-level supervisor."""
    try:
        from notifications.models import Notification
        from registry.models import Household

        household = Household.objects.select_related().filter(pk=household_id).first()
        if not household:
            logger.error("Escalation failed: household %s not found", household_id)
            return

        # Find supervisor for this geography
        from django.contrib.auth import get_user_model

        user_model = get_user_model()
        supervisors = user_model.objects.filter(
            role__in=["block_manager", "district_officer", "admin"],
            block=household.block,
        ).values_list("pk", flat=True)[:5]

        if not supervisors:
            # Fallback: any district-level supervisor
            supervisors = user_model.objects.filter(
                role__in=["district_officer", "admin"],
                district=household.district,
            ).values_list("pk", flat=True)[:3]

        for sup_id in supervisors:
            Notification.objects.create(
                recipient_id=sup_id,
                channel="in_app",
                title="⚠️ Emergency Escalation",
                body=(
                    f"No ASHA worker available for {severity} risk emergency at "
                    f"{household.head_name}'s household in {household.village}."
                    + (f" Offline for {offline_duration_minutes} minutes." if offline_duration_minutes else "")
                ),
                payload={
                    "type": "emergency_escalation",
                    "household_id": household_id,
                    "severity": severity,
                },
            )

        logger.info(
            "Emergency escalated to %d supervisors for household=%s",
            len(supervisors),
            household_id,
        )
    except Exception:
        logger.exception("Escalation failed for household=%s", household_id)
