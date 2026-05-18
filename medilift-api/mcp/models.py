import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class CareInteraction(models.Model):
    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    patient = models.ForeignKey("registry.Patient", related_name="care_interactions", on_delete=models.CASCADE)
    protocol = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)
    occurred_at = models.DateTimeField(default=timezone.now)
    payload = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-occurred_at"]
