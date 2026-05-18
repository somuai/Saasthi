from django.conf import settings
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AuditLog, User
from .serializers import OTPRequestSerializer, OTPVerifySerializer, UserSerializer


def audit(request, action, resource="", resource_id="", metadata=None):
    AuditLog.objects.create(
        actor=request.user if getattr(request, "user", None) and request.user.is_authenticated else None,
        action=action,
        resource_type=resource,
        resource_id=str(resource_id or ""),
        metadata=metadata or {},
        ip_address=request.META.get("REMOTE_ADDR"),
    )


class OTPRequestView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = OTPRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        challenge, code = serializer.save()
        payload = {"detail": "OTP generated.", "challenge_id": challenge.id}
        if settings.EXPOSE_DEBUG_OTP:
            payload["debug_otp"] = code
        return Response(payload, status=status.HTTP_201_CREATED)


class OTPVerifyView(APIView):
    authentication_classes = []
    permission_classes = []

    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.save()
        return Response(payload)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("id")
    serializer_class = UserSerializer
    filterset_fields = ["role", "region", "district", "block", "village"]

    def perform_create(self, serializer):
        user = serializer.save()
        audit(self.request, "user.create", "User", user.pk)

    def perform_update(self, serializer):
        user = serializer.save()
        audit(self.request, "user.update", "User", user.pk)

    @action(detail=False, methods=["get"])
    def me(self, request):
        return Response(self.get_serializer(request.user).data)
