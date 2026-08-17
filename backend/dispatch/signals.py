import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from dispatch.models import EmergencyDispatch, VisitStateLog

logger = logging.getLogger(__name__)


@receiver(post_save, sender=VisitStateLog)
def on_visit_state_changed(sender, instance, created, **kwargs):
    """
    Trigger side effects when a VisitStateLog is created (which happens on state transitions).
    """
    if not created:
        return

    # Trigger async side-effects based on the new state
    if instance.to_state == "EMERGENCY":
        from dispatch.tasks import dispatch_emergency_task

        visit = instance.visit
        household = visit.patient.household if hasattr(visit, "patient") and visit.patient else None
        if household and household.lat and household.lng:
            dispatch_emergency_task.delay(
                patient_lat=float(household.lat),
                patient_lng=float(household.lng),
                severity="HIGH",
                household_id=household.pk,
            )
            logger.info("Emergency dispatch triggered via signal for visit %s", visit.pk)

    elif instance.to_state == "COMPLETED":
        # Verification pending
        logger.info("Visit %s completed (signal) — verification pending", instance.visit.pk)


@receiver(post_save, sender=EmergencyDispatch)
def on_emergency_dispatch_saved(sender, instance, created, update_fields, **kwargs):
    """
    React to EmergencyDispatch state changes.
    """
    if created:
        pass
    else:
        # Check if state was updated
        if update_fields and "state" in update_fields and instance.state == EmergencyDispatch.State.ESCALATED:
            from dispatch.tasks import escalate_to_supervisor

            escalate_to_supervisor.delay(
                household_id=instance.household_id,
                severity=instance.severity,
                offline_duration_minutes=instance.offline_duration_minutes or 0,
            )
