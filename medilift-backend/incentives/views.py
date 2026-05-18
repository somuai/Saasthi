from rest_framework import viewsets

from .models import IncentiveLedgerEntry
from .serializers import IncentiveLedgerEntrySerializer


class IncentiveLedgerEntryViewSet(viewsets.ModelViewSet):
    serializer_class = IncentiveLedgerEntrySerializer
    filterset_fields = ["category", "worker"]

    def get_queryset(self):
        qs = IncentiveLedgerEntry.objects.select_related("worker")
        if self.request.user.role in {"admin", "supervisor", "auditor"} or self.request.user.is_superuser:
            return qs
        return qs.filter(worker=self.request.user)
