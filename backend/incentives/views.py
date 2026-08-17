from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import ASHAWorkerProfile, IncentiveLedgerEntry, IncentiveRate
from .serializers import (
    ASHAWorkerProfileSerializer,
    IncentiveLedgerEntrySerializer,
    IncentiveRateSerializer,
    MonthlySummarySerializer,
)
from .services.payslip_service import PayslipService


class IsSupervisorOrAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in {"supervisor", "admin", "auditor"}


class IncentiveLedgerEntryViewSet(viewsets.ModelViewSet):
    serializer_class = IncentiveLedgerEntrySerializer
    filterset_fields = ["category", "worker", "status", "activity_type", "month_year"]
    throttle_scope = "incentives"

    def get_queryset(self):
        qs = IncentiveLedgerEntry.objects.select_related("worker")
        if self.request.user.role in {"admin", "supervisor", "auditor"} or self.request.user.is_superuser:
            return qs
        return qs.filter(worker=self.request.user)

    @action(detail=False, methods=["get"], url_path=r"payslip/(?P<month_year>[^/.]+)")
    def payslip(self, request, month_year=None):
        if not month_year or len(month_year) != 7 or "-" not in month_year:
            return Response({"detail": "Invalid month_year format. Use YYYY-MM."}, status=status.HTTP_400_BAD_REQUEST)
        incentives = IncentiveLedgerEntry.objects.filter(
            worker=request.user,
            month_year=month_year,
        )
        svc = PayslipService()
        pdf_bytes = svc.generate(request.user, incentives, month_year)
        filename = f"payslip-{request.user.pk}-{month_year}.pdf"
        response = StreamingHttpResponse(
            iter([pdf_bytes]),
            content_type="application/pdf",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response

    @action(detail=True, methods=["post"], permission_classes=[IsSupervisorOrAdmin])
    def approve(self, request, pk=None):
        entry = self.get_object()
        if entry.status != IncentiveLedgerEntry.Status.PENDING:
            return Response(
                {"detail": f"Cannot approve entry with status '{entry.status}'. Must be 'pending'."},
                status=status.HTTP_409_CONFLICT,
            )
        entry.status = IncentiveLedgerEntry.Status.APPROVED
        entry.approved_by = str(request.user)
        entry.approved_at = timezone.now()
        entry.save(update_fields=["status", "approved_by", "approved_at"])
        return Response(self.get_serializer(entry).data)

    @action(detail=True, methods=["post"], permission_classes=[IsSupervisorOrAdmin])
    def mark_paid(self, request, pk=None):
        entry = self.get_object()
        if entry.status != IncentiveLedgerEntry.Status.APPROVED:
            return Response(
                {"detail": f"Cannot mark paid entry with status '{entry.status}'. Must be 'approved'."},
                status=status.HTTP_409_CONFLICT,
            )
        entry.status = IncentiveLedgerEntry.Status.PAID
        entry.paid_at = timezone.now()
        entry.save(update_fields=["status", "paid_at"])
        return Response(self.get_serializer(entry).data)

    @action(detail=False, methods=["get"], url_path=r"monthly_summary/(?P<month_year>[^/.]+)")
    def monthly_summary(self, request, month_year=None):
        if not month_year or len(month_year) != 7 or "-" not in month_year:
            return Response({"detail": "Invalid month_year format. Use YYYY-MM."}, status=status.HTTP_400_BAD_REQUEST)
        qs = self.get_queryset().filter(month_year=month_year)
        by_category = {}
        for entry in qs:
            cat = entry.activity_type.split("_")[0] if "_" in entry.activity_type else entry.activity_type
            by_category[cat] = by_category.get(cat, 0) + entry.amount_paise

        total_paise = sum(entry.amount_paise for entry in qs)
        data = {
            "worker_id": request.user.pk,
            "worker_name": request.user.get_full_name() or request.user.phone or "—",
            "month_year": month_year,
            "total_paise": total_paise,
            "total_rupees": total_paise / 100,
            "entries_count": qs.count(),
            "by_category": by_category,
        }
        serializer = MonthlySummarySerializer(data)
        return Response(serializer.data)


class IncentiveRateViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = IncentiveRate.objects.filter(is_active=True)
    serializer_class = IncentiveRateSerializer
    pagination_class = None
    throttle_scope = "incentives"
    permission_classes = [permissions.IsAuthenticated]


class ASHAWorkerProfileViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ASHAWorkerProfileSerializer
    throttle_scope = "incentives"
    lookup_field = "asha_id"
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if self.request.user.role in {"admin", "supervisor", "auditor"} or self.request.user.is_superuser:
            return ASHAWorkerProfile.objects.select_related("user").all()
        return ASHAWorkerProfile.objects.select_related("user").filter(user=self.request.user)
