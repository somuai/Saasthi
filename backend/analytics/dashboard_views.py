import csv
from datetime import timedelta

from accounts.models import User
from django.db.models import Count
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
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
        if request.user.role == User.Role.SUPERVISOR:
            for field in ("region", "district", "block", "village"):
                value = getattr(request.user, field, "")
                if value:
                    patients = patients.filter(**{field: value})
        patient_ids = patients.values("id")
        flags = Flag.objects.select_related("patient").filter(patient_id__in=patient_ids)
        referrals = Referral.objects.select_related("patient").filter(patient_id__in=patient_ids)
        surveys = SurveyResponse.objects.select_related("patient").filter(patient_id__in=patient_ids)
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


class ASHAMetricsView(APIView):
    throttle_scope = "analytics"
    permission_classes = [IsAuthenticated]

    def get(self, request, asha_id):
        user = get_object_or_404(User, pk=asha_id, role=User.Role.HEALTH_WORKER)
        if request.user.role not in (User.Role.ADMIN, User.Role.AUDITOR):
            from accounts.models import WorkerRegistration

            if not WorkerRegistration.objects.filter(
                supervisor=request.user, phone=user.phone, is_active=True
            ).exists():
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied("You do not supervise this ASHA worker.")

        patients = Patient.objects.filter(asha_worker=user)
        now = timezone.now()
        week_ago = now - timedelta(days=7)
        thirty_days_ago = now - timedelta(days=30)

        total_patients = patients.count()
        active_patients = patients.filter(status="active").count()
        pregnant = patients.filter(pregnancy_status=True).count()
        high_risk = patients.filter(is_high_risk_pregnancy=True).count()
        registered_this_month = patients.filter(created_at__gte=thirty_days_ago).count()

        patient_ids = patients.values("id")
        open_flags = Flag.objects.filter(patient_id__in=patient_ids, status=Flag.Status.OPEN).count()
        referrals = Referral.objects.filter(patient_id__in=patient_ids).count()
        pending_referrals = Referral.objects.filter(patient_id__in=patient_ids, status=Referral.Status.DRAFT).count()

        surveys_this_week = SurveyResponse.objects.filter(
            patient_id__in=patient_ids, submitted_at__gte=week_ago
        ).count()

        returned_data = {
            "asha_id": user.pk,
            "asha_name": user.get_full_name() or user.first_name or user.phone,
            "phone": user.phone,
            "village": user.village,
            "block": user.block,
            "district": user.district,
            "is_active": user.is_active,
            "last_login": user.last_login,
            "metrics": {
                "total_patients": total_patients,
                "active_patients": active_patients,
                "pregnant": pregnant,
                "high_risk_pregnancies": high_risk,
                "registered_this_month": registered_this_month,
                "open_flags": open_flags,
                "total_referrals": referrals,
                "pending_referrals": pending_referrals,
                "surveys_this_week": surveys_this_week,
            },
        }
        return Response(returned_data)
