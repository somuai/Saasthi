import random

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import OTPChallenge
from .sms import send_otp_sms

User = get_user_model()


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
        user, _ = User.objects.get_or_create(
            phone=phone,
            defaults={"username": phone, "role": User.Role.HEALTH_WORKER},
        )
        refresh = RefreshToken.for_user(user)
        return {
            "user": UserSerializer(user).data,
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "local_uuid", "username", "phone", "first_name", "last_name", "role", "region", "district", "block", "village"]
        read_only_fields = ["id", "local_uuid"]
