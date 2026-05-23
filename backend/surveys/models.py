import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class SurveyResponse(models.Model):
    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    patient = models.ForeignKey("registry.Patient", related_name="survey_responses", on_delete=models.CASCADE)
    survey_type = models.CharField(max_length=80, db_index=True)
    answers = models.JSONField(default=dict, blank=True)
    submitted_at = models.DateTimeField(default=timezone.now)
    synced_at = models.DateTimeField(null=True, blank=True)
    score_snapshot = models.JSONField(default=dict, blank=True)
    photo_base64 = models.TextField(blank=True, help_text="Optional wound/rash photo in base64")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["patient", "submitted_at"], name="ix_survey_patient_submitted"),
            models.Index(fields=["local_uuid"], name="ix_survey_local_uuid"),
            models.Index(fields=["created_by"], name="ix_survey_created_by"),
            models.Index(fields=["synced_at"], name="ix_survey_synced_at"),
        ]

    def __str__(self):
        return f"{self.survey_type} for {self.patient_id}"
