import logging
from io import StringIO

import h3
from accounts.models import User, WorkerRegistration
from django.core.management import call_command
from django.db.models import Count, Q
from django.db.models.functions import TruncDate
from django.shortcuts import get_object_or_404
from django.utils import timezone
from flagging.models import Flag
from followups.models import FollowUp, VisitRecord
from incentives.models import IncentiveLedgerEntry
from mcp.models import (
    ANCVisit,
    CareInteraction,
    DeliveryRecord,
    DevelopmentMilestoneCheck,
    GrowthRecord,
    ImmunizationRecord,
    PNCVisit,
)
from referrals.models import Referral
from registry.models import Patient
from rest_framework import generics
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from shaasthi_backend.querysets import for_user_geography
from surveys.models import SurveyResponse

from .serializers import (
    ANCVisitSerializer,
    ASHADetailSerializer,
    ASHAListSerializer,
    CareInteractionSerializer,
    DeliveryRecordSerializer,
    DevelopmentMilestoneSerializer,
    FlagListSerializer,
    FlagUpdateSerializer,
    GrowthRecordSerializer,
    ImmunizationRecordSerializer,
    IncentiveListSerializer,
    PatientDetailSerializer,
    PatientListSerializer,
    PatientWriteSerializer,
    PNCVisitSerializer,
    ReferralListSerializer,
    ReferralUpdateSerializer,
    SurveyResponseSerializer,
)

# Administrative roles that may use the supervisor dashboard.
# Mirrors the frontend sidebar (Layout.tsx) and for_user_geography(): admins,
# auditors and state_admins see global scope, while supervisors and the
# district/block officers are geo-scoped by _scope_user_geography().
ADMIN_ROLES = (
    User.Role.ADMIN,
    User.Role.AUDITOR,
    User.Role.SUPERVISOR,
    User.Role.STATE_ADMIN,
    User.Role.DISTRICT_OFFICER,
    User.Role.BLOCK_MANAGER,
)


class IsANMOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and request.user.role in ADMIN_ROLES


logger = logging.getLogger(__name__)


def _scope_user_geography(request, qs):
    result = for_user_geography(qs, request.user)
    user = request.user
    if result is not None and result != qs:
        return result
    if user.role == User.Role.SUPERVISOR:
        for field in ("region", "district", "block", "village"):
            value = getattr(user, field, "")
            if value:
                result = (result or qs).filter(**{field: value})
    return result or qs


def _scoped_workers(request):
    qs = User.objects.filter(role=User.Role.HEALTH_WORKER)
    if request.user.role == User.Role.SUPERVISOR:
        phones = WorkerRegistration.objects.filter(supervisor=request.user, is_active=True).values_list(
            "phone", flat=True
        )
        qs = qs.filter(phone__in=phones)
    return qs


def _percentage(part, whole):
    if not whole:
        return 0
    return round((part / whole) * 100, 1)


class DashboardSummary(APIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]

    def get(self, request):
        patients = _scope_user_geography(request, Patient.objects.all())
        patient_ids = patients.values("id")
        flags = Flag.objects.filter(patient_id__in=patient_ids)
        referrals = Referral.objects.filter(patient_id__in=patient_ids)
        followups = FollowUp.objects.filter(patient_id__in=patient_ids)
        workers = _scoped_workers(request)
        total_patients = patients.count()
        complete_records = patients.exclude(village="").filter(household__isnull=False).count()
        recently_active_workers = workers.filter(last_login__gte=timezone.now() - timezone.timedelta(days=2)).count()
        data = {
            "total_patients": total_patients,
            "active_patients": patients.filter(status="active").count(),
            "pregnant": patients.filter(pregnancy_status=True).count(),
            "high_risk": patients.filter(is_high_risk_pregnancy=True).count(),
            "high_risk_patients": patients.filter(is_high_risk_pregnancy=True).count(),
            "open_flags": flags.filter(status=Flag.Status.OPEN).count(),
            "active_alerts": flags.filter(status=Flag.Status.OPEN).count(),
            "total_referrals": referrals.count(),
            "pending_referrals": referrals.filter(status=Referral.Status.DRAFT).count(),
            "total_ashas": workers.count(),
            "follow_ups_due": followups.filter(
                status=FollowUp.Status.PENDING,
                scheduled_date__lte=timezone.localdate(),
            ).count(),
            "overdue_followups": followups.filter(
                status=FollowUp.Status.PENDING,
                scheduled_date__lt=timezone.localdate(),
            ).count(),
            "data_quality_score": _percentage(complete_records, total_patients),
            "worker_availability": _percentage(recently_active_workers, workers.count()),
            "registered_ashas": (
                WorkerRegistration.objects.filter(is_active=True, supervisor=request.user).count()
                if request.user.role == User.Role.SUPERVISOR
                else WorkerRegistration.objects.filter(is_active=True).count()
            ),
            "flags_by_severity": list(flags.values("severity").annotate(count=Count("id")).order_by("severity")),
            "referrals_by_status": list(referrals.values("status").annotate(count=Count("id")).order_by("status")),
        }
        return Response(data)


class AnalyticsOverview(APIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]

    def get(self, request):
        patients = _scope_user_geography(
            request,
            Patient.objects.select_related("household", "asha_worker").all(),
        )
        patient_ids = patients.values("id")
        total_patients = patients.count()
        high_risk = patients.filter(is_high_risk_pregnancy=True).count()
        critical_flags = Flag.objects.filter(
            patient_id__in=patient_ids,
            status=Flag.Status.OPEN,
            severity__iexact="critical",
        ).count()
        medium_flags = Flag.objects.filter(
            patient_id__in=patient_ids,
            status=Flag.Status.OPEN,
            severity__iexact="medium",
        ).count()
        low_count = max(total_patients - high_risk - critical_flags, 0)

        risk_rows = [
            {"level": "Critical", "count": critical_flags},
            {"level": "High", "count": high_risk},
            {"level": "Medium", "count": medium_flags},
            {"level": "Low", "count": low_count},
        ]
        for row in risk_rows:
            row["pct"] = _percentage(row["count"], total_patients)

        age_buckets = {"0-5": 0, "6-17": 0, "18-25": 0, "26-35": 0, "36-59": 0, "60+": 0, "Unknown": 0}
        today = timezone.localdate()
        for patient in patients.only("date_of_birth"):
            if not patient.date_of_birth:
                age_buckets["Unknown"] += 1
                continue
            age = (
                today.year
                - patient.date_of_birth.year
                - ((today.month, today.day) < (patient.date_of_birth.month, patient.date_of_birth.day))
            )
            if age <= 5:
                age_buckets["0-5"] += 1
            elif age <= 17:
                age_buckets["6-17"] += 1
            elif age <= 25:
                age_buckets["18-25"] += 1
            elif age <= 35:
                age_buckets["26-35"] += 1
            elif age <= 59:
                age_buckets["36-59"] += 1
            else:
                age_buckets["60+"] += 1

        condition_rows = [
            {"condition": "Pregnancy", "count": patients.filter(pregnancy_status=True).count()},
            {"condition": "High-risk Pregnancy", "count": high_risk},
            {"condition": "Hypertension", "count": patients.filter(hypertension=True).count()},
            {"condition": "Diabetes", "count": patients.filter(diabetes=True).count()},
            {"condition": "TB history", "count": patients.filter(tb_history=True).count()},
        ]

        heatmap = {}
        for patient in patients.exclude(household__lat__isnull=True).exclude(household__lng__isnull=True)[:2000]:
            cell = h3.latlng_to_cell(patient.household.lat, patient.household.lng, 8)
            if cell not in heatmap:
                lat, lng = h3.cell_to_latlng(cell)
                heatmap[cell] = {
                    "h3_index": cell,
                    "lat": lat,
                    "lng": lng,
                    "total_patients": 0,
                    "high_risk_count": 0,
                    "assigned_workers": 0,
                    "coverage_ratio": 0,
                }
            heatmap[cell]["total_patients"] += 1
            if patient.is_high_risk_pregnancy:
                heatmap[cell]["high_risk_count"] += 1

        worker_count = _scoped_workers(request).count()
        for cell in heatmap.values():
            cell["risk_density"] = cell["high_risk_count"] / cell["total_patients"] if cell["total_patients"] else 0
            cell["assigned_workers"] = worker_count
            cell["coverage_ratio"] = _percentage(worker_count, cell["total_patients"])

        return Response(
            {
                "kpis": [
                    {
                        "key": "reg",
                        "label": "Total Registrations",
                        "value": total_patients,
                        "change_pct": 0,
                        "trend": [],
                    },
                    {"key": "high", "label": "High Risk Detections", "value": high_risk, "change_pct": 0, "trend": []},
                    {
                        "key": "ref",
                        "label": "Referrals Completed",
                        "value": Referral.objects.filter(
                            patient_id__in=patient_ids, status=Referral.Status.COMPLETED
                        ).count(),
                        "change_pct": 0,
                        "trend": [],
                    },
                    {
                        "key": "vis",
                        "label": "Visit Completion Rate",
                        "value": _percentage(
                            FollowUp.objects.filter(
                                patient_id__in=patient_ids, status=FollowUp.Status.COMPLETED
                            ).count(),
                            FollowUp.objects.filter(patient_id__in=patient_ids).count(),
                        ),
                        "unit": "%",
                        "change_pct": 0,
                        "trend": [],
                    },
                ],
                "risk_distribution": risk_rows,
                "age_demographics": [{"bracket": label, "count": count} for label, count in age_buckets.items()],
                "condition_prevalence": [row for row in condition_rows if row["count"] > 0],
                "h3_heatmap": list(heatmap.values()),
            }
        )


class AnalyticsTrendData(APIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]

    def get(self, request):
        metric = request.query_params.get("metric", "registrations")
        days = min(max(int(request.query_params.get("days", 30)), 1), 90)
        start = timezone.localdate() - timezone.timedelta(days=days)
        patients = _scope_user_geography(request, Patient.objects.all())
        patient_ids = patients.values("id")

        if metric == "high_risk":
            qs = patients.filter(is_high_risk_pregnancy=True, created_at__date__gte=start)
            date_field = "created_at"
        elif metric == "referrals":
            qs = Referral.objects.filter(patient_id__in=patient_ids, created_at__date__gte=start)
            date_field = "created_at"
        elif metric == "visits":
            qs = VisitRecord.objects.filter(patient_id__in=patient_ids, created_at__date__gte=start)
            date_field = "created_at"
        else:
            qs = patients.filter(created_at__date__gte=start)
            date_field = "created_at"

        counts = {
            row["day"].isoformat(): row["count"]
            for row in qs.annotate(day=TruncDate(date_field)).values("day").annotate(count=Count("id"))
        }
        return Response(
            [
                {
                    "date": (start + timezone.timedelta(days=offset)).isoformat(),
                    "value": counts.get((start + timezone.timedelta(days=offset)).isoformat(), 0),
                }
                for offset in range(days + 1)
            ]
        )


class WorkerScorecard(APIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]

    def get(self, request, pk):
        worker = get_object_or_404(_scoped_workers(request), pk=pk)
        patients = Patient.objects.filter(asha_worker=worker)
        visits_this_month = VisitRecord.objects.filter(
            worker=worker,
            created_at__date__gte=timezone.localdate().replace(day=1),
        ).count()
        due_followups = FollowUp.objects.filter(worker=worker, status=FollowUp.Status.PENDING).count()
        completed_followups = FollowUp.objects.filter(worker=worker, status=FollowUp.Status.COMPLETED).count()
        total_followups = due_followups + completed_followups
        complete_patients = patients.exclude(village="").filter(household__isnull=False).count()
        active_patients = patients.filter(status="active").count()

        return Response(
            [
                {"axis": "Visits", "value": min(visits_this_month * 10, 100)},
                {"axis": "Follow-up", "value": _percentage(completed_followups, total_followups)},
                {"axis": "Coverage", "value": min(active_patients, 100)},
                {"axis": "Data Quality", "value": _percentage(complete_patients, patients.count())},
                {
                    "axis": "Risk Attention",
                    "value": min(patients.filter(is_high_risk_pregnancy=True).count() * 20, 100),
                },
            ]
        )


class RecentActivity(APIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]

    def get(self, request):
        if request.user.role == User.Role.SUPERVISOR:
            reg_phones = WorkerRegistration.objects.filter(supervisor=request.user, is_active=True).values_list(
                "phone", flat=True
            )
            workers = User.objects.filter(phone__in=reg_phones).values_list("pk", flat=True)
        else:
            workers = None

        events = []

        # Recent Patient Registrations.
        # NOTE: filter BEFORE slicing — Django raises
        # "Cannot filter a query once a slice has been taken" otherwise.
        recent_patients = Patient.objects.all().order_by("-created_at")
        if workers is not None:
            recent_patients = recent_patients.filter(asha_worker_id__in=workers)
        for p in recent_patients[:15]:
            events.append(
                {
                    "type": "patient_created",
                    "description": f"Patient {p.full_name} registered",
                    "timestamp": p.created_at.isoformat(),
                    "resource_id": p.pk,
                    "resource_type": "patient",
                }
            )

        # Recent ASHA Worker Onboardings (filter before slice, as above)
        recent_ashas = User.objects.filter(role=User.Role.HEALTH_WORKER).order_by("-date_joined")
        if workers is not None:
            recent_ashas = recent_ashas.filter(pk__in=workers)
        for asha in recent_ashas[:15]:
            events.append(
                {
                    "type": "asha_onboarded",
                    "description": f"ASHA Worker {asha.first_name or asha.phone or asha.username} onboarded from {asha.village or 'unknown village'}",
                    "timestamp": asha.date_joined.isoformat(),
                    "resource_id": asha.pk,
                    "resource_type": "asha",
                }
            )

        # Sort all activities chronologically descending (newest first)
        events.sort(key=lambda x: x["timestamp"], reverse=True)

        return Response(events[:20])


class PatientListCreate(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]
    pagination_class = None

    def get_serializer_class(self):
        if self.request.method == "POST":
            return PatientWriteSerializer
        return PatientListSerializer

    def get_queryset(self):
        qs = Patient.objects.select_related("asha_worker", "household").all()
        qs = _scope_user_geography(self.request, qs)
        status_filter = self.request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(Q(full_name__icontains=search) | Q(phone__icontains=search) | Q(village__icontains=search))
        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class PatientDetail(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]
    serializer_class = PatientDetailSerializer

    def get_queryset(self):
        return _scope_user_geography(self.request, Patient.objects.select_related("asha_worker", "household").all())

    def perform_update(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        instance.delete()


class PatientMCPDataView(APIView):
    """Return all MCP clinical data for a single patient."""

    permission_classes = [IsAuthenticated, IsANMOrAdmin]

    def get(self, request, pk):
        patient = get_object_or_404(
            _scope_user_geography(request, Patient.objects.select_related("asha_worker", "household").all()),
            pk=pk,
        )

        anc_visits = ANCVisit.objects.filter(patient=patient).order_by("visit_number")
        deliveries = DeliveryRecord.objects.filter(mother_patient=patient).order_by("delivery_date")
        pnc_visits = PNCVisit.objects.filter(mother_patient=patient).order_by("visit_date")
        growth_records = GrowthRecord.objects.filter(patient=patient).order_by("recorded_date")
        immunizations = ImmunizationRecord.objects.filter(patient=patient).order_by("scheduled_date")
        milestones = DevelopmentMilestoneCheck.objects.filter(patient=patient).order_by("check_date")
        care_interactions = CareInteraction.objects.filter(patient=patient).order_by("-occurred_at")[:50]
        survey_responses = SurveyResponse.objects.filter(patient=patient).order_by("-submitted_at")

        return Response(
            {
                "anc_visits": ANCVisitSerializer(anc_visits, many=True).data,
                "deliveries": DeliveryRecordSerializer(deliveries, many=True).data,
                "pnc_visits": PNCVisitSerializer(pnc_visits, many=True).data,
                "growth_records": GrowthRecordSerializer(growth_records, many=True).data,
                "immunizations": ImmunizationRecordSerializer(immunizations, many=True).data,
                "milestones": DevelopmentMilestoneSerializer(milestones, many=True).data,
                "care_interactions": CareInteractionSerializer(care_interactions, many=True).data,
                "survey_responses": SurveyResponseSerializer(survey_responses, many=True).data,
            }
        )


class ASHAList(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]
    serializer_class = ASHAListSerializer
    pagination_class = None

    def get_queryset(self):
        qs = User.objects.filter(role=User.Role.HEALTH_WORKER).annotate(
            patients_count=Count("assigned_patients", filter=Q(assigned_patients__status="active")),
        )
        if self.request.user.role == User.Role.SUPERVISOR:
            phones = WorkerRegistration.objects.filter(supervisor=self.request.user, is_active=True).values_list(
                "phone", flat=True
            )
            qs = qs.filter(phone__in=phones)
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(phone__icontains=search)
                | Q(village__icontains=search)
            )
        return qs.order_by("first_name")


class ASHADetail(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]
    serializer_class = ASHADetailSerializer

    def get_queryset(self):
        qs = User.objects.filter(role=User.Role.HEALTH_WORKER).prefetch_related(
            "assigned_patients", "incentive_entries"
        )
        return qs


class FlagList(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]
    serializer_class = FlagListSerializer
    pagination_class = None

    def get_queryset(self):
        qs = Flag.objects.select_related("patient").all().order_by("-created_at")
        patient_ids = _scope_user_geography(self.request, Patient.objects.all()).values("id")
        return qs.filter(patient_id__in=patient_ids)


class FlagUpdate(generics.UpdateAPIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]
    queryset = Flag.objects.all()
    serializer_class = FlagUpdateSerializer


class IncentiveList(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]
    serializer_class = IncentiveListSerializer
    pagination_class = None

    def get_queryset(self):
        qs = IncentiveLedgerEntry.objects.select_related("worker").all().order_by("-created_at")
        if self.request.user.role == User.Role.SUPERVISOR:
            phones = WorkerRegistration.objects.filter(supervisor=self.request.user, is_active=True).values_list(
                "phone", flat=True
            )
            workers = User.objects.filter(phone__in=phones).values_list("pk", flat=True)
            qs = qs.filter(worker_id__in=workers)
        return qs


class IncentiveApprove(APIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]

    def post(self, request, pk):
        entry = get_object_or_404(IncentiveLedgerEntry, pk=pk)
        entry.status = IncentiveLedgerEntry.Status.APPROVED
        entry.approved_by = str(request.user)
        entry.approved_at = timezone.now()
        entry.save()
        return Response({"status": "approved"})


class IncentivePay(APIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]

    def post(self, request, pk):
        entry = get_object_or_404(IncentiveLedgerEntry, pk=pk)
        entry.status = IncentiveLedgerEntry.Status.PAID
        entry.paid_at = timezone.now()
        entry.save()
        return Response({"status": "paid"})


class ReferralList(generics.ListAPIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]
    serializer_class = ReferralListSerializer
    pagination_class = None

    def get_queryset(self):
        qs = Referral.objects.select_related("patient").all().order_by("-created_at")
        patient_ids = _scope_user_geography(self.request, Patient.objects.all()).values("id")
        return qs.filter(patient_id__in=patient_ids)


class ReferralUpdate(generics.UpdateAPIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]
    queryset = Referral.objects.all()
    serializer_class = ReferralUpdateSerializer


class CommandRunner(APIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]

    def post(self, request):
        command = request.data.get("command", "").strip()
        args = request.data.get("args", [])
        if not command:
            return Response({"error": "No command specified"}, status=400)
        allowed = {
            "delete_gonda_test_data",
            "auto_assign_patients",
            "seed_gonda_ashas",
            "collect_real_phones",
        }
        if command not in allowed:
            return Response({"error": f"Command '{command}' not allowed"}, status=403)
        out = StringIO()
        err = StringIO()
        try:
            call_command(command, *args, stdout=out, stderr=err)
            return Response({"stdout": out.getvalue(), "stderr": err.getvalue()})
        except Exception as e:
            logger.exception("Command %s failed", command)
            return Response({"error": str(e), "stdout": out.getvalue(), "stderr": err.getvalue()}, status=500)
