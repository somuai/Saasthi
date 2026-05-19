import uuid

from django.conf import settings
from django.db import models


class SyncEvent(models.Model):
    class Status(models.TextChoices):
        APPLIED = "applied", "Applied"
        DUPLICATE = "duplicate", "Duplicate"
        ERROR = "error", "Error"

    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    client_id = models.CharField(max_length=120)
    event_type = models.CharField(max_length=40, default="upsert")
    model_name = models.CharField(max_length=80)
    object_local_uuid = models.CharField(max_length=80, blank=True)
    payload_hash = models.CharField(max_length=64)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.APPLIED)
    message = models.TextField(blank=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-received_at"]
        indexes = [models.Index(fields=["client_id", "model_name", "object_local_uuid"])]
