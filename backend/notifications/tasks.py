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


@app.on_after_finalize.connect
def setup_periodic_tasks(sender, **_):
    sender.add_periodic_task(
        timedelta(hours=8),
        send_daily_visit_reminders.s(),
        name="daily-visit-reminder-8am",
    )
