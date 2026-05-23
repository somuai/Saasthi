import random

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .firebase_auth import verify_firebase_token
from .models import OTPChallenge, WorkerRegistration
from .sms import send_otp_sms

User = get_user_model()


def resolve_worker(phone):
    reg = WorkerRegistration.objects.filter(phone=phone, is_active=True).first()
    if not reg:
        raise serializers.ValidationError("This number is not registered. Contact your ANM supervisor.")
    user, created = User.objects.get_or_create(
        phone=phone,
        defaults={
            "username": phone,
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
        code = f"{random.SystemRandom().randint(0, 999999):06d}"
        challenge = OTPChallenge.create_for_code(validated_data["phone"], code, validated_data.get("purpose", "login"))
        send_otp_sms(validated_data["phone"], code)
        return challenge, code


class OTPVerifySerializer(serializers.Serializer):
    phone = serializers.CharField(max_length=32)
    code = serializers.CharField(max_length=6, min_length=4)
    purpose = serializers.CharField(max_length=32, default="login", required=False)

    def validate(self, attrs):
        challenge = (
            OTPChallenge.objects.filter(phone=attrs["phone"], purpose=attrs.get("purpose", "login"))
            .order_by("-created_at")
            .first()
        )
        if not challenge:
            raise serializers.ValidationError("No OTP challenge found.")
        challenge.attempts += 1
        challenge.save(update_fields=["attempts"])
        if not challenge.is_valid or challenge.code_hash != OTPChallenge.hash_code(attrs["phone"], attrs["code"]):
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
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_supervisor_name(self, obj):
        if not obj.supervisor:
            return None
        return obj.supervisor.get_full_name() or obj.supervisor.first_name or obj.supervisor.phone


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
        ]
        read_only_fields = ["id", "local_uuid", "role"]
