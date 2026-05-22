import uuid

from django.conf import settings
from django.db import models


class VisitVerificationOTP(models.Model):
    patient = models.ForeignKey("registry.Patient", on_delete=models.CASCADE)
    asha_worker = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    otp_hash = models.CharField(max_length=200)
    sent_to_phone = models.CharField(max_length=32)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)
    attempt_count = models.PositiveSmallIntegerField(default=0)
    verified_at = models.DateTimeField(null=True, blank=True)
    bypass_reason = models.CharField(max_length=200, blank=True, default="")
    bypass_approved_by = models.CharField(max_length=100, blank=True, default="")

    class Meta:
        indexes = [
            models.Index(fields=["patient", "asha_worker"], name="ix_visit_otp_patient_worker"),
        ]

    def __str__(self):
        return f"VisitOTP for {self.patient_id} (used={self.is_used})"


class FollowUp(models.Model):
    class Urgency(models.TextChoices):
        WITHIN_24H = "within_24h", "Within 24 hours"
        WITHIN_3_DAYS = "within_3_days", "Within 3 days"
        ROUTINE = "routine", "Routine"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        COMPLETED = "completed", "Completed"
        MISSED = "missed", "Missed"

    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    patient = models.ForeignKey("registry.Patient", related_name="followups", on_delete=models.CASCADE)
    worker = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="followups", on_delete=models.CASCADE)
    scheduled_date = models.DateField()
    urgency = models.CharField(max_length=20, choices=Urgency.choices, default=Urgency.ROUTINE)
    triggered_by_assessment = models.ForeignKey(
        "risk_engine.RiskAssessment", null=True, blank=True, on_delete=models.SET_NULL,
        related_name="triggered_followups",
    )
    is_auto_scheduled = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    completed_at = models.DateTimeField(null=True, blank=True)
    completion_notes = models.TextField(blank=True)
    incentive_claimed = models.BooleanField(default=False)

    # GPS verification
    visit_lat = models.FloatField(null=True, blank=True)
    visit_lng = models.FloatField(null=True, blank=True)
    visit_accuracy_m = models.FloatField(null=True, blank=True)
    visit_gps_timestamp = models.DateTimeField(null=True, blank=True)
    distance_from_household_m = models.FloatField(null=True, blank=True)
    gps_verification_status = models.CharField(
        max_length=20, blank=True, default="not_captured",
    )

    # Visit OTP verification
    visit_otp_verified = models.BooleanField(default=False)
    visit_otp_bypassed = models.BooleanField(default=False)
    bypass_reason = models.CharField(max_length=200, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["scheduled_date"]
        indexes = [
            models.Index(fields=["worker", "scheduled_date"], name="ix_followup_worker_date"),
            models.Index(fields=["patient", "status"], name="ix_followup_patient_status"),
            models.Index(fields=["status"], name="ix_followup_status"),
        ]

    def __str__(self):
        return f"FollowUp {self.patient_id} on {self.scheduled_date} ({self.status})"


class VisitRecord(models.Model):
    class Condition(models.TextChoices):
        GOOD = "good", "Good"
        FAIR = "fair", "Fair"
        POOR = "poor", "Poor"

    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    patient = models.ForeignKey("registry.Patient", related_name="visit_records", on_delete=models.CASCADE)
    worker = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="visit_records", on_delete=models.CASCADE)
    follow_up = models.ForeignKey(FollowUp, null=True, blank=True, on_delete=models.SET_NULL, related_name="visits")
    visit_date = models.DateField()
    visit_time = models.TimeField(null=True, blank=True)
    condition_observed = models.CharField(max_length=20, choices=Condition.choices, default=Condition.GOOD)
    notes = models.TextField(blank=True)
    next_visit_date = models.DateField(null=True, blank=True)
    referred_to_phc = models.BooleanField(default=False)
    referral_facility = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-visit_date"]
        indexes = [
            models.Index(fields=["worker", "visit_date"], name="ix_visit_worker_date"),
            models.Index(fields=["patient", "visit_date"], name="ix_visit_patient_date"),
        ]

    def __str__(self):
        return f"Visit {self.patient_id} on {self.visit_date}"
