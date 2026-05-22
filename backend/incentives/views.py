from django.http import StreamingHttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import IncentiveLedgerEntry
from .serializers import IncentiveLedgerEntrySerializer
from .services.payslip_service import PayslipService


class IncentiveLedgerEntryViewSet(viewsets.ModelViewSet):
    serializer_class = IncentiveLedgerEntrySerializer
    filterset_fields = ["category", "worker"]

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
            worker=request.user, month_year=month_year,
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
