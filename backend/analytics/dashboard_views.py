import csv

from django.db.models import Count
from django.http import HttpResponse
from flagging.models import Flag
from referrals.models import Referral
from registry.models import Patient
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from shaasthi_backend.querysets import for_user_geography
from surveys.models import SurveyResponse


class RoleRequiredPermission(IsAuthenticated):
    """DRF permission that checks the user's role against allowed_roles."""

    def __init__(self, allowed_roles=None):
        self.allowed_roles = allowed_roles or ()
        super().__init__()

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        roles = getattr(view, "allowed_roles", self.allowed_roles)
        if not roles:
            return True
        return request.user.role in roles


class SupervisorDashboardSummaryView(APIView):
    allowed_roles = ("admin", "supervisor", "auditor")
    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if self.allowed_roles and request.user.role not in self.allowed_roles:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Access restricted to supervisors and admins.")

    def get(self, request):
        patients = for_user_geography(Patient.objects.all(), request.user)
        patient_ids = patients.values("id")
        flags = Flag.objects.filter(patient_id__in=patient_ids)
        referrals = Referral.objects.filter(patient_id__in=patient_ids)
        surveys = SurveyResponse.objects.filter(patient_id__in=patient_ids)
        return Response(
            {
                "patients": patients.count(),
                "surveys": surveys.count(),
                "open_flags": flags.filter(status=Flag.Status.OPEN).count(),
                "flags_by_severity": list(flags.values("severity").annotate(count=Count("id")).order_by("severity")),
                "referrals_by_status": list(referrals.values("status").annotate(count=Count("id")).order_by("status")),
            }
        )


class FlagCSVExportView(APIView):
    allowed_roles = ("admin", "supervisor", "auditor")
    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if self.allowed_roles and request.user.role not in self.allowed_roles:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Access restricted to supervisors and admins.")

    def get(self, request):
        patients = for_user_geography(Patient.objects.all(), request.user)
        flags = (
            Flag.objects.select_related("patient").filter(patient_id__in=patients.values("id")).order_by("-updated_at")
        )
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="shaasthi-flags.csv"'
        writer = csv.writer(response)
        writer.writerow(["local_uuid", "patient", "flag_type", "source", "severity", "status", "score", "updated_at"])
        for flag in flags:
            writer.writerow(
                [
                    flag.local_uuid,
                    flag.patient.full_name,
                    flag.flag_type,
                    flag.source,
                    flag.severity,
                    flag.status,
                    flag.score,
                    flag.updated_at.isoformat(),
                ]
            )
        return response
