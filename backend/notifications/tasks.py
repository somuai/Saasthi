from datetime import timedelta

from celery import shared_task
from shaasthi_backend.celery import app


@shared_task
def send_daily_visit_reminders():
    from accounts.models import User

    from notifications.services import send_bulk_notification

    users = User.objects.filter(
        fcm_token__gt="",
        notifications_enabled=True,
        role__in=("field_worker", "asha", "health_worker"),
    )
    if not users.exists():
        return "No users with FCM tokens; skipped"
    sent = send_bulk_notification(
        users,
        title="भेंट याद दिलायें / Visit Reminder",
        body="आज के लिए कितने परिवारों को भेंट शेष हैं?",
        payload={"type": "visit_reminder"},
    )
    return f"Reminder sent to {sent}/{users.count()} users"


@shared_task
def send_followup_alert(followup_id):
    from registry.models import FollowUp

    followup = FollowUp.objects.select_related("created_by").get(pk=followup_id)
    user = followup.created_by
    if not user or not user.fcm_token:
        return
    from notifications.services import send_fcm_notification

    send_fcm_notification(
        user,
        title="Follow-up Due",
        body="Follow-up visit for patient is scheduled.",
        payload={"type": "followup_alert", "followup_id": str(followup_id)},
    )


@shared_task
def send_immunization_due_reminders():
    from django.utils import timezone
    from mcp.models import ImmunizationRecord

    from notifications.services import send_fcm_notification

    today = timezone.localdate()
    due_soon = today + timedelta(days=3)
    records = ImmunizationRecord.objects.filter(
        scheduled_date__gte=today,
        scheduled_date__lte=due_soon,
        status="due",
    ).select_related("patient", "asha_worker")

    sent = 0
    for rec in records:
        user = rec.asha_worker
        if not user or not user.fcm_token:
            continue
        patient_name = rec.patient.full_name or f"Patient {rec.patient.local_uuid}"
        ok = send_fcm_notification(
            user,
            title="Immunization Due",
            body=f"{patient_name}: {rec.vaccine_name} dose {rec.dose_number} due on {rec.scheduled_date}.",
            payload={
                "type": "immunization_due",
                "patient_local_uuid": str(rec.patient.local_uuid),
                "immunization_local_uuid": str(rec.local_uuid),
                "vaccine_name": rec.vaccine_name,
                "scheduled_date": str(rec.scheduled_date),
            },
        )
        if ok:
            sent += 1
    return f"Immunization reminders sent to {sent} ASHA workers"


@app.on_after_finalize.connect
def setup_periodic_tasks(sender, **_):
    sender.add_periodic_task(
        timedelta(hours=8),
        send_daily_visit_reminders.s(),
        name="daily-visit-reminder-8am",
    )
    sender.add_periodic_task(
        timedelta(hours=12),
        send_immunization_due_reminders.s(),
        name="immunization-due-reminder-6am-6pm",
    )
