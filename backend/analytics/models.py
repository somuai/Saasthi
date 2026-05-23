import uuid

from django.db import models


class AnalyticsSnapshot(models.Model):
    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    name = models.CharField(max_length=120)
    metrics = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"AnalyticsSnapshot '{self.name}' ({self.local_uuid})"
