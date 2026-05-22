import json

from django.conf import settings
from django.utils import timezone

from .models import Notification


def _get_firebase_app():
    import firebase_admin
    from firebase_admin import credentials

    if firebase_admin._apps.get("shaashti"):
        return firebase_admin.get_app("shaashti")

    if settings.FIREBASE_SERVICE_ACCOUNT_JSON:
        cred = credentials.Certificate(
            json.loads(settings.FIREBASE_SERVICE_ACCOUNT_JSON)
        )
    elif settings.FIREBASE_SERVICE_ACCOUNT_PATH:
        cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_PATH)
    else:
        return None

    return firebase_admin.initialize_app(cred, name="shaashti")


def send_fcm_notification(user, title, body, payload=None, save_in_app=True):
    if not user.fcm_token or not user.notifications_enabled:
        return False

    app = _get_firebase_app()
    if app is None:
        return False

    try:
        from firebase_admin import messaging

        msg = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (payload or {}).items()},
            token=user.fcm_token,
        )
        messaging.send(msg, app=app)
    except Exception as exc:
        code = getattr(exc, "code", None) or str(exc)
        if "UNREGISTERED" in code or "INVALID_ARGUMENT" in code:
            user.fcm_token = ""
            user.fcm_token_updated = timezone.now()
            user.save(update_fields=["fcm_token", "fcm_token_updated"])
        return False

    if save_in_app:
        Notification.objects.create(
            recipient=user,
            channel=Notification.Channel.IN_APP,
            title=title,
            body=body,
            payload=payload or {},
        )
    return True


def send_bulk_notification(users, title, body, payload=None):
    sent = 0
    for user in users:
        if send_fcm_notification(user, title, body, payload):
            sent += 1
    return sent
