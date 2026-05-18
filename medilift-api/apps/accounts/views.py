import re
import random

from django.contrib.auth.models import User
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken


class RequestOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        phone = request.data.get("phone", "")
        if not re.match(r"^\+91[6-9]\d{9}$", phone):
            return Response({"error": "Invalid phone number"}, status=400)
        otp = "".join(str(random.randint(0, 9)) for _ in range(6))
        # Demo: log only — wire MSG91/Twilio in production
        return Response({"message": "OTP sent successfully", "dev_otp": otp})


class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        phone = request.data.get("phone", "")
        otp = request.data.get("otp", "")
        if len(otp) != 6:
            return Response({"error": "Invalid OTP"}, status=400)
        username = phone.replace("+", "")
        user, _ = User.objects.get_or_create(
            username=username,
            defaults={"email": f"{username}@medilift.local", "first_name": "ASHA", "last_name": "Worker"},
        )
        refresh = RefreshToken.for_user(user)
        worker = {
            "serverId": str(user.id),
            "name": user.get_full_name() or "ASHA Worker",
            "village": "Demo Village",
            "block": "Demo Block",
            "workerCode": f"ASHA-{user.id}",
        }
        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {"id": user.id, "phone": phone, "username": user.username},
                "worker": worker,
            }
        )
