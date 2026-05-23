import uuid

from django.conf import settings
from django.db import models


class Referral(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SENT = "sent", "Sent"
        ACCEPTED = "accepted", "Accepted"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    patient = models.ForeignKey("registry.Patient", related_name="referrals", on_delete=models.SET_NULL, null=True)
    flag = models.ForeignKey(
        "flagging.Flag", null=True, blank=True, related_name="referrals", on_delete=models.SET_NULL
    )
    destination = models.CharField(max_length=180)
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.DRAFT)
    metadata = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["patient", "status"], name="ix_referral_patient_status"),
            models.Index(fields=["destination"], name="ix_referral_destination"),
        ]

    def __str__(self):
        return f"Referral {self.patient_id} -> {self.destination} ({self.status})"
