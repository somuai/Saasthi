import hashlib
import uuid

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    class Role(models.TextChoices):
        ADMIN = "admin", "Admin"
        SUPERVISOR = "supervisor", "Supervisor"
        HEALTH_WORKER = "health_worker", "Health worker"
        REFERRAL_PARTNER = "referral_partner", "Referral partner"
        AUDITOR = "auditor", "Auditor"

    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    phone = models.CharField(max_length=32, unique=True, null=True, blank=True)
    role = models.CharField(max_length=32, choices=Role.choices, default=Role.HEALTH_WORKER)
    region = models.CharField(max_length=120, blank=True)
    district = models.CharField(max_length=120, blank=True)
    block = models.CharField(max_length=120, blank=True)
    village = models.CharField(max_length=120, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return self.phone or self.username


class OTPChallenge(models.Model):
    phone = models.CharField(max_length=32, db_index=True)
    code_hash = models.CharField(max_length=64)
    purpose = models.CharField(max_length=32, default="login")
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    @staticmethod
    def hash_code(phone, code):
        raw = f"{settings.SECRET_KEY}:{phone}:{code}".encode()
        return hashlib.sha256(raw).hexdigest()

    @classmethod
    def create_for_code(cls, phone, code, purpose="login"):
        return cls.objects.create(
            phone=phone,
            code_hash=cls.hash_code(phone, code),
            purpose=purpose,
            expires_at=timezone.now() + timezone.timedelta(minutes=settings.OTP_TTL_MINUTES),
        )

    @property
    def is_valid(self):
        return self.consumed_at is None and self.expires_at > timezone.now() and self.attempts < 5


class AuditLog(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=120)
    resource_type = models.CharField(max_length=120, blank=True)
    resource_id = models.CharField(max_length=120, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
