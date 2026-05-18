import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class IncentiveLedgerEntry(models.Model):
    class Category(models.TextChoices):
        QUALITY = "quality", "Quality milestone"
        TRAINING = "training", "Training"
        TRANSPORT = "transport", "Transport support"
        SUPPLIES = "supplies", "Supplies"

    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    worker = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="incentive_entries", on_delete=models.CASCADE)
    category = models.CharField(max_length=32, choices=Category.choices)
    description = models.TextField(blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def clean(self):
        if self.category not in {choice[0] for choice in self.Category.choices}:
            raise ValidationError("Referral-volume commission incentives are not allowed.")
