import uuid

from django.conf import settings
from django.db import models


class Notification(models.Model):
    class Channel(models.TextChoices):
        IN_APP = "in_app", "In-app"
        SMS = "sms", "SMS"

    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="notifications", on_delete=models.CASCADE)
    channel = models.CharField(max_length=20, choices=Channel.choices, default=Channel.IN_APP)
    title = models.CharField(max_length=160)
    body = models.TextField(blank=True)
    payload = models.JSONField(default=dict, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "created_at"], name="ix_notif_recipient_created"),
            models.Index(fields=["channel"], name="ix_notif_channel"),
            models.Index(fields=["read_at"], name="ix_notif_read_at"),
        ]

    def __str__(self):
        return f"Notification '{self.title[:50]}' to {self.recipient_id} via {self.channel}"
