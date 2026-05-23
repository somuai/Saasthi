from registry.models import Patient
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from shaasthi_backend.permissions import RolePermission

from .models import FollowUp, VisitRecord
from .serializers import FollowUpSerializer, VisitRecordSerializer
from .services import visit_otp_service
from .services.gps_service import classify_gps_visit


class FollowUpViewSet(viewsets.ModelViewSet):
    queryset = FollowUp.objects.select_related("patient", "worker").all()
    serializer_class = FollowUpSerializer
    permission_classes = [RolePermission]
    allowed_roles = ["health_worker", "supervisor"]
    filterset_fields = ["status", "urgency", "scheduled_date", "patient", "worker"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == "health_worker":
            qs = qs.filter(worker=user)
        return qs

    @action(detail=False, methods=["post"], url_path="verify/request-otp")
    def request_visit_otp(self, request):
        patient_id = request.data.get("patient_id")
        if not patient_id:
            return Response({"detail": "patient_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            patient = Patient.objects.get(pk=patient_id)
        except Patient.DoesNotExist:
            return Response({"detail": "Patient not found."}, status=status.HTTP_404_NOT_FOUND)

        household = patient.household
        result = visit_otp_service.generate_and_send(patient, request.user, household)
        return Response(result)

    request_visit_otp.throttle_scope = "otp"

    @action(detail=False, methods=["post"], url_path="verify/verify-otp")
    def verify_visit_otp(self, request):
        otp_id = request.data.get("otp_id")
        otp_input = request.data.get("otp_input")
        if not otp_id or not otp_input:
            return Response({"detail": "otp_id and otp_input are required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            visit_otp_service.verify(otp_id, otp_input)
            return Response({"verified": True, "visit_unlocked": True})
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    verify_visit_otp.throttle_scope = "otp"

    @action(detail=False, methods=["post"], url_path="verify/bypass-otp")
    def bypass_visit_otp(self, request):
        patient_id = request.data.get("patient_id")
        reason = request.data.get("reason", "no_phone")
        if not patient_id:
            return Response({"detail": "patient_id is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            patient = Patient.objects.get(pk=patient_id)
        except Patient.DoesNotExist:
            return Response({"detail": "Patient not found."}, status=status.HTTP_404_NOT_FOUND)

        result = visit_otp_service.apply_bypass(patient, request.user, reason)
        return Response({"bypassed": True, **result})

    bypass_visit_otp.throttle_scope = "otp"


class VisitRecordViewSet(viewsets.ModelViewSet):
    queryset = VisitRecord.objects.select_related("patient", "worker", "follow_up").all()
    serializer_class = VisitRecordSerializer
    permission_classes = [RolePermission]
    allowed_roles = ["health_worker", "supervisor"]
    filterset_fields = ["visit_date", "condition_observed", "referred_to_phc", "patient", "worker"]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if user.role == "health_worker":
            qs = qs.filter(worker=user)
        return qs

    def perform_create(self, serializer):
        obj = serializer.save()
        cls = obj
        if cls.visit_lat is not None and cls.visit_lng is not None and cls.patient is not None:
            household = cls.patient.household
            result = classify_gps_visit(
                cls.visit_lat,
                cls.visit_lng,
                household.lat if household else None,
                household.lng if household else None,
                cls.visit_accuracy_m or 0.0,
            )
            cls.distance_from_household_m = result["distance_m"]
            cls.gps_verification_status = result["status"]
            cls.save(update_fields=["distance_from_household_m", "gps_verification_status"])
