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
    role = models.CharField(max_length=32, choices=Role.choices, default=Role.HEALTH_WORKER, db_index=True)
    region = models.CharField(max_length=120, blank=True, db_index=True)
    district = models.CharField(max_length=120, blank=True, db_index=True)
    block = models.CharField(max_length=120, blank=True, db_index=True)
    village = models.CharField(max_length=120, blank=True, db_index=True)
    requires_review = models.BooleanField(default=False, help_text="Flagged for ANM review during backfill")
    fcm_token = models.CharField(max_length=500, blank=True, default="")
    fcm_token_updated = models.DateTimeField(null=True, blank=True)
    notifications_enabled = models.BooleanField(default=True)
    metadata = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return self.phone or self.username


class OTPChallenge(models.Model):
    phone = models.CharField(max_length=32, db_index=True)
    code_hash = models.CharField(max_length=64)
    purpose = models.CharField(max_length=32, default="login")
    expires_at = models.DateTimeField(db_index=True)
    consumed_at = models.DateTimeField(null=True, blank=True, db_index=True)
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

    def __str__(self):
        return f"OTP to {self.phone} for {self.purpose}"


class AuthSession(models.Model):
    worker = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="auth_sessions", on_delete=models.CASCADE)
    refresh_token_hash = models.CharField(max_length=128, db_index=True)
    device_info = models.CharField(max_length=255, blank=True)
    last_active_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["worker", "expires_at"], name="ix_auth_session_worker_expires"),
        ]

    @property
    def is_valid(self):
        return self.revoked_at is None and self.expires_at > __import__("django").utils.timezone.now()

    def __str__(self):
        return f"Session {self.pk or 'new'} for {self.worker_id}"


class WorkerRegistration(models.Model):
    phone = models.CharField(max_length=32, unique=True, db_index=True)
    full_name = models.CharField(max_length=255)
    supervisor = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="registered_workers",
        limit_choices_to={"role": "supervisor"},
        null=True,
        blank=True,
    )
    village = models.CharField(max_length=120, blank=True, default="")
    block = models.CharField(max_length=120, blank=True, default="")
    district = models.CharField(max_length=120, blank=True, default="")
    region = models.CharField(max_length=120, blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["supervisor", "is_active"], name="ix_wreg_supervisor_active"),
            models.Index(fields=["phone", "is_active"], name="ix_wreg_phone_active"),
        ]

    def __str__(self):
        return f"{self.full_name} ({self.phone})"


class AuditLog(models.Model):
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, db_index=True)
    action = models.CharField(max_length=120, db_index=True)
    resource_type = models.CharField(max_length=120, blank=True, db_index=True)
    resource_id = models.CharField(max_length=120, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["action", "created_at"], name="ix_audit_action_created"),
            models.Index(fields=["actor", "created_at"], name="ix_audit_actor_created"),
        ]

    def __str__(self):
        return f"{self.action} on {self.resource_type}#{self.resource_id} by {self.actor_id}"
