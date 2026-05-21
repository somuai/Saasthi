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

    class ActivityType(models.TextChoices):
        SURVEY_COMPLETION = "survey_completion", "Survey completion"
        HIGH_RISK_IDENTIFICATION = "high_risk_identification", "High risk identification"
        HARD_FLAG_REFERRAL = "hard_flag_referral", "Hard flag referral"
        FOLLOWUP_COMPLETED = "followup_completed_on_time", "Follow-up completed on time"
        FOLLOWUP_MISSED = "followup_missed", "Follow-up missed"
        ANC_REGISTRATION = "anc_registration", "ANC registration"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        PAID = "paid", "Paid"

    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    worker = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="incentive_entries", on_delete=models.CASCADE)
    # Deprecated compat fields — kept for migration safety, use new fields below
    category = models.CharField(max_length=32, choices=Category.choices, blank=True)
    description = models.TextField(blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    # New fields
    activity_type = models.CharField(max_length=40, choices=ActivityType.choices, default=ActivityType.SURVEY_COMPLETION)
    amount_paise = models.PositiveIntegerField(default=0, help_text="Amount in paise (rupees × 100)")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    reference_id = models.UUIDField(null=True, blank=True)
    reference_type = models.CharField(max_length=50, blank=True)
    approved_by = models.CharField(max_length=100, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    month_year = models.CharField(max_length=7, blank=True, db_index=True, help_text="e.g. 2026-05")
    description_en = models.TextField(blank=True)
    description_hi = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["worker", "month_year"], name="ix_incentive_worker_month"),
            models.Index(fields=["status"], name="ix_incentive_status"),
        ]

    @property
    def amount_rupees(self):
        return self.amount_paise / 100

    def clean(self):
        if self.activity_type not in {choice[0] for choice in self.ActivityType.choices}:
            raise ValidationError(f"Invalid activity type: {self.activity_type}")

    def __str__(self):
        return f"{self.activity_type} ₹{self.amount_rupees:.2f} for {self.worker_id}"
