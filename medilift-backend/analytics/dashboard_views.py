import csv

from django.db.models import Count
from django.http import HttpResponse
from rest_framework.response import Response
from rest_framework.views import APIView

from flagging.models import Flag
from medilift_backend.querysets import for_user_geography
from referrals.models import Referral
from registry.models import Patient
from surveys.models import SurveyResponse


class SupervisorDashboardSummaryView(APIView):
    allowed_roles = ("admin", "supervisor", "auditor")

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

    def get(self, request):
        patients = for_user_geography(Patient.objects.all(), request.user)
        flags = Flag.objects.select_related("patient").filter(patient_id__in=patients.values("id")).order_by("-updated_at")
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="medilift-flags.csv"'
        writer = csv.writer(response)
        writer.writerow(["local_uuid", "patient", "flag_type", "source", "severity", "status", "score", "updated_at"])
        for flag in flags:
            writer.writerow([flag.local_uuid, flag.patient.full_name, flag.flag_type, flag.source, flag.severity, flag.status, flag.score, flag.updated_at.isoformat()])
        return response
