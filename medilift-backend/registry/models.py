import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Household(models.Model):
    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    region = models.CharField(max_length=120, blank=True)
    district = models.CharField(max_length=120, blank=True)
    block = models.CharField(max_length=120, blank=True)
    village = models.CharField(max_length=120, blank=True)
    address = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.village or self.block or 'Household'}:{self.local_uuid}"


class Patient(models.Model):
    class Gender(models.TextChoices):
        FEMALE = "female", "Female"
        MALE = "male", "Male"
        OTHER = "other", "Other"
        UNKNOWN = "unknown", "Unknown"

    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    household = models.ForeignKey(Household, null=True, blank=True, related_name="patients", on_delete=models.SET_NULL)
    full_name = models.CharField(max_length=180)
    phone = models.CharField(max_length=32, blank=True)
    gender = models.CharField(max_length=16, choices=Gender.choices, default=Gender.UNKNOWN)
    date_of_birth = models.DateField(null=True, blank=True)
    region = models.CharField(max_length=120, blank=True)
    district = models.CharField(max_length=120, blank=True)
    block = models.CharField(max_length=120, blank=True)
    village = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=32, default="active")
    metadata = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def age_years(self):
        if not self.date_of_birth:
            return None
        today = timezone.localdate()
        return today.year - self.date_of_birth.year - ((today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day))

    def __str__(self):
        return self.full_name
