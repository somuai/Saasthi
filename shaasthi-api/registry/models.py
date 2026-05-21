import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Household(models.Model):
    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    household_code = models.CharField(max_length=32, unique=True, blank=True, null=True)
    head_name = models.CharField(max_length=180, blank=True)
    head_name_hi = models.CharField(max_length=180, blank=True)
    region = models.CharField(max_length=120, blank=True)
    district = models.CharField(max_length=120, blank=True)
    block = models.CharField(max_length=120, blank=True)
    village = models.CharField(max_length=120, blank=True)
    address = models.TextField(blank=True)
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)
    member_count = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["village", "is_active"], name="ix_household_village_active"),
        ]

    def __str__(self):
        code = self.household_code or f"HH-{self.local_uuid}"
        return f"{code} ({self.village or self.block or 'Unknown'})"


class Patient(models.Model):
    class Gender(models.TextChoices):
        FEMALE = "female", "Female"
        MALE = "male", "Male"
        OTHER = "other", "Other"
        UNKNOWN = "unknown", "Unknown"

    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    household = models.ForeignKey(Household, null=True, blank=True, related_name="patients", on_delete=models.SET_NULL)
    full_name = models.CharField(max_length=180)
    name_hi = models.CharField(max_length=180, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    gender = models.CharField(max_length=16, choices=Gender.choices, default=Gender.UNKNOWN)
    date_of_birth = models.DateField(null=True, blank=True)
    relationship_to_head = models.CharField(max_length=50, blank=True)
    region = models.CharField(max_length=120, blank=True)
    district = models.CharField(max_length=120, blank=True)
    block = models.CharField(max_length=120, blank=True)
    village = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=32, default="active")
    asha_worker = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="assigned_patients",
    )
    diabetes = models.BooleanField(default=False)
    hypertension = models.BooleanField(default=False)
    tb_history = models.BooleanField(default=False)
    prev_hospitalized = models.BooleanField(default=False)
    pregnancy_status = models.BooleanField(default=False)
    prev_high_risk_count = models.PositiveIntegerField(default=0)
    metadata = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL,
        related_name="created_patients",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["household"], name="ix_patient_household"),
            models.Index(fields=["asha_worker"], name="ix_patient_asha_worker"),
            models.Index(fields=["status"], name="ix_patient_status"),
            models.Index(fields=["village", "status"], name="ix_patient_village_status"),
        ]

    @property
    def age_years(self):
        if not self.date_of_birth:
            return None
        today = timezone.localdate()
        return today.year - self.date_of_birth.year - ((today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day))

    def __str__(self):
        return self.full_name
