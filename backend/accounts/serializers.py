import random
import re

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework_simplejwt.tokens import RefreshToken

from .firebase_auth import verify_firebase_pnv_token, verify_firebase_token
from .models import OTPChallenge, WorkerRegistration
from .tasks import send_otp_sms_task

User = get_user_model()

_PHONE_CLEAN_RE = re.compile(r"[^\d+]")


def normalize_phone(raw):
    """Normalize phone to +91XXXXXXXXXX and extract 10-digit form."""
    cleaned = _PHONE_CLEAN_RE.sub("", raw.strip())
    if cleaned.startswith("+"):
        phone_raw = cleaned
        phone_10digit = cleaned[3:] if cleaned.startswith("+91") else cleaned[1:]
    elif cleaned.startswith("91") and len(cleaned) == 12:
        phone_10digit = cleaned[2:]
        phone_raw = f"+{cleaned}"
    elif len(cleaned) == 10:
        phone_10digit = cleaned
        phone_raw = f"+91{cleaned}"
    else:
        phone_raw = cleaned
        phone_10digit = cleaned
    return phone_raw, phone_10digit


def normalize_phone_strict(raw):
    """Normalize and return the canonical +91XXXXXXXXXX form. Raises on failure."""
    phone_raw, phone_10digit = normalize_phone(raw)
    if not (10 <= len(phone_10digit) <= 11 and phone_10digit.isdigit()):
        raise serializers.ValidationError("Invalid phone number format (must be 10 or 11 digits).")
    return phone_raw


def resolve_worker(phone):
    from django.conf import settings

    clean_phone, phone_10digit = normalize_phone(phone)

    phone_filter = Q(phone=clean_phone) | Q(phone=phone_10digit)
    reg = WorkerRegistration.objects.filter(phone_filter, is_active=True).first()
    has_inactive_registration = WorkerRegistration.objects.filter(phone_filter, is_active=False).exists()

    # Admin/supervisor users can log in without worker pre-registration, but an
    # explicitly deactivated worker registration must never be bypassed by a
    # phone collision with another user record.
    user = User.objects.filter(phone_filter).first()
    if user and user.role != User.Role.HEALTH_WORKER and not has_inactive_registration:
        return user
    if has_inactive_registration and not reg:
        raise NotFound("Phone not registered. Contact your ANM supervisor.")

    if not reg:
        import sys

        if settings.DEBUG and "pytest" not in sys.modules:
            from django.contrib.auth import get_user_model

            user_model = get_user_model()
            supervisor = (
                user_model.objects.filter(role=user_model.Role.SUPERVISOR).first()
                or user_model.objects.filter(is_superuser=True).first()
            )
            if not supervisor:
                supervisor = user_model.objects.create_superuser(
                    username="dev_admin",
                    phone="+919999999999",
                    first_name="Dev",
                    last_name="Admin",
                    role=user_model.Role.ADMIN,
                )
            reg = WorkerRegistration.objects.create(
                phone=clean_phone,
                full_name=f"Dev Worker {phone_10digit}",
                supervisor=supervisor,
                created_by=supervisor,
                village="Dev Village",
                block="Dev Block",
                district="Dev District",
                region="Dev Region",
                is_active=True,
            )
        else:
            raise NotFound("Phone not registered. Contact your ANM supervisor.")

    user, created = User.objects.get_or_create(
        phone=clean_phone,
        defaults={
            "username": clean_phone,
            "first_name": reg.full_name,
            "role": User.Role.HEALTH_WORKER,
            "village": reg.village,
            "block": reg.block,
            "district": reg.district,
            "region": reg.region,
        },
    )
    if not created:
        user.first_name = reg.full_name
        user.village = reg.village or user.village
        user.block = reg.block or user.block
        user.district = reg.district or user.district
        user.region = reg.region or user.region
        user.save(update_fields=["first_name", "village", "block", "district", "region"])
    return user


class OTPRequestSerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=32)
    purpose = serializers.CharField(max_length=32, default="login", required=False)

    def create(self, validated_data):
        phone = normalize_phone_strict(validated_data["phone"])
        code = f"{random.SystemRandom().randint(0, 999999):06d}"
        challenge = OTPChallenge.create_for_code(phone, code, validated_data.get("purpose", "login"))
        send_otp_sms_task.delay(phone, code)
        return challenge, code


class OTPVerifySerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=32)
    code = serializers.CharField(max_length=6, min_length=4, required=False)
    otp = serializers.CharField(max_length=6, min_length=4, required=False)
    purpose = serializers.CharField(max_length=32, default="login", required=False)

    def validate(self, attrs):
        code_val = attrs.get("code") or attrs.get("otp")
        if not code_val:
            raise serializers.ValidationError("OTP or Code is required.")
        attrs["code"] = code_val

        phone = normalize_phone_strict(attrs["phone"])
        challenge = (
            OTPChallenge.objects.filter(phone=phone, purpose=attrs.get("purpose", "login"))
            .order_by("-created_at")
            .first()
        )
        if not challenge:
            raise serializers.ValidationError("No OTP challenge found.")
        challenge.attempts += 1
        challenge.save(update_fields=["attempts"])
        if not challenge.is_valid or challenge.code_hash != OTPChallenge.hash_code(phone, attrs["code"]):
            raise serializers.ValidationError("Invalid or expired OTP.")
        attrs["challenge"] = challenge
        return attrs

    def create(self, validated_data):
        challenge = validated_data["challenge"]
        challenge.consumed_at = timezone.now()
        challenge.save(update_fields=["consumed_at"])
        phone = validated_data["phone"]
        user = resolve_worker(phone)
        refresh = RefreshToken.for_user(user)
        refresh["role"] = user.role
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])

        from services.telemetry import track_event

        track_event(
            distinct_id=str(user.local_uuid),
            event_name="user_logged_in",
            properties={"role": user.role, "login_method": "otp"},
        )

        return {
            "user": UserSerializer(user).data,
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }


class FirebaseVerifySerializer(serializers.Serializer):
    id_token = serializers.CharField()

    def validate(self, attrs):
        decoded = verify_firebase_token(attrs["id_token"])
        if not decoded:
            raise serializers.ValidationError("Invalid or expired Firebase token.")
        phone = decoded.get("phone_number")
        if not phone:
            raise serializers.ValidationError("No phone number in Firebase token.")
        attrs["phone"] = phone
        return attrs

    def create(self, validated_data):
        phone = validated_data["phone"]
        user = resolve_worker(phone)
        refresh = RefreshToken.for_user(user)
        refresh["role"] = user.role
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])

        from services.telemetry import track_event

        track_event(
            distinct_id=str(user.local_uuid),
            event_name="user_logged_in",
            properties={"role": user.role, "login_method": "firebase"},
        )

        return {
            "user": UserSerializer(user).data,
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }


class FirebasePNVVerifySerializer(serializers.Serializer):
    pnv_token = serializers.CharField()
    phone = serializers.CharField(max_length=32, required=False, allow_blank=True)

    def validate(self, attrs):
        phone_hint = normalize_phone_strict(attrs["phone"]) if attrs.get("phone") else ""
        decoded = verify_firebase_pnv_token(attrs["pnv_token"], phone_hint=phone_hint)
        phone = decoded.get("phone_number") or decoded.get("phone")
        if not phone:
            raise serializers.ValidationError("No phone number in Firebase PNV token.")
        attrs["phone"] = normalize_phone_strict(phone)
        return attrs

    def create(self, validated_data):
        phone = validated_data["phone"]
        user = resolve_worker(phone)
        refresh = RefreshToken.for_user(user)
        refresh["role"] = user.role
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])

        from services.telemetry import track_event

        track_event(
            distinct_id=str(user.local_uuid),
            event_name="user_logged_in",
            properties={"role": user.role, "login_method": "firebase_pnv"},
        )

        return {
            "user": UserSerializer(user).data,
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }


class WorkerRegistrationSerializer(serializers.ModelSerializer):
    supervisor_name = serializers.SerializerMethodField()

    class Meta:
        model = WorkerRegistration
        fields = [
            "id",
            "phone",
            "full_name",
            "supervisor",
            "supervisor_name",
            "village",
            "block",
            "district",
            "region",
            "is_active",
            "estimated_households",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_phone(self, value):
        clean_phone, phone_10digit = normalize_phone(value)
        if not (len(phone_10digit) == 10 and phone_10digit.isdigit()):
            raise serializers.ValidationError("Invalid Indian phone number format (must be 10 digits)")
        return clean_phone

    def get_supervisor_name(self, obj):
        if not obj.supervisor:
            return None
        return obj.supervisor.get_full_name() or obj.supervisor.first_name or obj.supervisor.phone


class WorkerStatusSerializer(serializers.ModelSerializer):
    patients_count = serializers.IntegerField(read_only=True)
    has_registration = serializers.BooleanField(read_only=True)
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "local_uuid",
            "phone",
            "full_name",
            "role",
            "region",
            "district",
            "block",
            "village",
            "is_active",
            "last_login",
            "patients_count",
            "has_registration",
            "estimated_households",
        ]
        read_only_fields = fields

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.first_name or obj.phone


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "local_uuid",
            "username",
            "phone",
            "first_name",
            "last_name",
            "role",
            "region",
            "district",
            "block",
            "village",
            "is_active",
            "estimated_households",
        ]
        read_only_fields = ["id", "local_uuid", "role"]
