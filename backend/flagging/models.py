import uuid

from django.conf import settings
from django.db import models


class Flag(models.Model):
    class Status(models.TextChoices):
        OPEN = "open", "Open"
        ACKNOWLEDGED = "acknowledged", "Acknowledged"
        RESOLVED = "resolved", "Resolved"
        DISMISSED = "dismissed", "Dismissed"

    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    patient = models.ForeignKey("registry.Patient", related_name="flags", on_delete=models.SET_NULL, null=True)
    flag_type = models.CharField(max_length=80)
    source = models.CharField(max_length=80, default="manual")
    severity = models.CharField(max_length=20, default="medium")
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.OPEN)
    dedupe_key = models.CharField(max_length=240, unique=True)
    explanation = models.JSONField(default=dict, blank=True)
    score = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["patient", "status"], name="ix_flag_patient_status"),
            models.Index(fields=["flag_type"], name="ix_flag_type"),
            models.Index(fields=["severity"], name="ix_flag_severity"),
            models.Index(fields=["source"], name="ix_flag_source"),
        ]

    def __str__(self):
        return f"{self.flag_type}:{self.patient_id}:{self.status}"
