import logging

from django.conf import settings
from django.db.models import Count, Exists, OuterRef
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import AuditLog, User, WorkerRegistration
from .serializers import (
    FirebasePNVVerifySerializer,
    FirebaseVerifySerializer,
    OTPRequestSerializer,
    OTPVerifySerializer,
    UserSerializer,
    WorkerRegistrationSerializer,
    WorkerStatusSerializer,
)

logger = logging.getLogger(__name__)


def audit(request, action, resource="", resource_id="", metadata=None):
    try:
        AuditLog.objects.create(
            actor=request.user if getattr(request, "user", None) and request.user.is_authenticated else None,
            action=action,
            resource_type=resource,
            resource_id=str(resource_id or ""),
            metadata=metadata or {},
            ip_address=request.META.get("REMOTE_ADDR"),
        )
    except Exception:
        logger.exception("audit log failed for %s on %s#%s", action, resource, resource_id)


class OTPRequestView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "otp"
    serializer_class = OTPRequestSerializer

    @extend_schema(request=OTPRequestSerializer, responses={201: {"type": "object"}})
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
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "otp"
    serializer_class = OTPVerifySerializer

    @extend_schema(request=OTPVerifySerializer, responses={200: {"type": "object"}})
    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.save()
        return Response(payload)


@method_decorator(csrf_exempt, name="dispatch")
class FirebaseVerifyView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "otp"
    serializer_class = FirebaseVerifySerializer

    @extend_schema(request=FirebaseVerifySerializer, responses={200: {"type": "object"}})
    def post(self, request):
        serializer = FirebaseVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.save()
        return Response(payload)


@method_decorator(csrf_exempt, name="dispatch")
class FirebasePNVVerifyView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "otp"
    serializer_class = FirebasePNVVerifySerializer

    @extend_schema(request=FirebasePNVVerifySerializer, responses={200: {"type": "object"}})
    def post(self, request):
        serializer = FirebasePNVVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.save()
        return Response(payload)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("id")
    serializer_class = UserSerializer
    filterset_fields = ["role", "region", "district", "block", "village"]
    throttle_scope = "user_management"

    def perform_create(self, serializer):
        user = serializer.save()
        audit(self.request, "user.create", "User", user.pk)

    def perform_update(self, serializer):
        user = serializer.save()
        audit(self.request, "user.update", "User", user.pk)

    @action(detail=False, methods=["get"])
    def me(self, request):
        return Response(self.get_serializer(request.user).data)

    @action(detail=False, methods=["post"], url_path="fcm-token")
    def register_fcm_token(self, request):
        token = request.data.get("fcm_token", "").strip()
        if not token:
            return Response({"detail": "fcm_token required"}, status=status.HTTP_400_BAD_REQUEST)
        request.user.fcm_token = token
        from django.utils import timezone

        request.user.fcm_token_updated = timezone.now()
        request.user.save(update_fields=["fcm_token", "fcm_token_updated"])
        return Response({"status": "ok"})


class WorkerRegistrationViewSet(viewsets.ModelViewSet):
    serializer_class = WorkerRegistrationSerializer
    filterset_fields = ["village", "block", "district", "region", "is_active"]
    throttle_scope = "worker_registration"

    def get_queryset(self):
        user = self.request.user
        qs = WorkerRegistration.objects.select_related("supervisor").filter(is_active=True)
        if user.role in (User.Role.ADMIN, User.Role.AUDITOR):
            return qs.order_by("-created_at")
        return qs.filter(supervisor=user).order_by("-created_at")

    def perform_create(self, serializer):
        user = self.request.user
        phone = serializer.validated_data.get("phone")
        if phone and WorkerRegistration.objects.filter(phone=phone, is_active=True).exists():
            raise DRFValidationError({"phone": "An active registration with this phone already exists."})
        if user.role == User.Role.SUPERVISOR:
            serializer.save(supervisor=user, created_by=user)
        elif user.role in (User.Role.ADMIN, User.Role.AUDITOR):
            serializer.save(created_by=user)
        else:
            self.permission_denied(self.request, message="Only supervisors and admins can register workers.")
        audit(self.request, "worker_registration.create", "WorkerRegistration", serializer.instance.pk)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=["is_active"])
        audit(self.request, "worker_registration.deactivate", "WorkerRegistration", instance.pk)

    @action(detail=False, methods=["get"])
    def unassigned(self, request):
        registered_phones = WorkerRegistration.objects.filter(is_active=True).values("phone")
        qs = (
            User.objects.filter(
                role=User.Role.HEALTH_WORKER,
                phone__isnull=False,
            )
            .exclude(phone="")
            .exclude(
                phone__in=registered_phones,
            )
            .order_by("id")
        )
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = UserSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return Response(UserSerializer(qs, many=True).data)

    @action(detail=False, methods=["get"])
    def status(self, request):
        qs = User.objects.filter(role=User.Role.HEALTH_WORKER)
        if request.user.role not in (User.Role.ADMIN, User.Role.AUDITOR):
            registered_phones = WorkerRegistration.objects.filter(supervisor=request.user, is_active=True).values(
                "phone"
            )
            qs = qs.filter(phone__in=registered_phones)
        has_active_reg = WorkerRegistration.objects.filter(phone=OuterRef("phone"), is_active=True)
        qs = qs.annotate(
            patients_count=Count("assigned_patients"),
            has_registration=Exists(has_active_reg),
        ).order_by("id")
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = WorkerStatusSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        return Response(WorkerStatusSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"], url_path="claim")
    def claim(self, request, pk=None):
        target_user = get_object_or_404(User, pk=pk, role=User.Role.HEALTH_WORKER)
        if WorkerRegistration.objects.filter(phone=target_user.phone, is_active=True).exists():
            return Response({"detail": "Worker already registered."}, status=status.HTTP_409_CONFLICT)
        serializer = WorkerRegistrationSerializer(
            data={
                "phone": target_user.phone,
                "full_name": target_user.first_name or target_user.phone,
            },
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(supervisor=request.user, created_by=request.user)
        target_user.requires_review = False
        target_user.is_active = True
        target_user.save(update_fields=["requires_review", "is_active"])
        audit(request, "worker.claim", "User", target_user.pk)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["post"], url_path="bulk-import")
    def bulk_import(self, request):
        if request.user.role not in (User.Role.SUPERVISOR, User.Role.ADMIN, User.Role.AUDITOR):
            self.permission_denied(request, message="Only supervisors and admins can bulk-import workers.")
        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response({"detail": "CSV file required (field name: 'file')"}, status=status.HTTP_400_BAD_REQUEST)
        from .services import import_workers_csv

        results = import_workers_csv(uploaded.read(), supervisor=request.user, file_name=uploaded.name)
        audit(request, "worker.bulk_import", "WorkerRegistration", results)
        return Response(results)
