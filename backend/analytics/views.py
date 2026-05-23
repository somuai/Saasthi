from rest_framework import viewsets

from .models import AnalyticsSnapshot
from .serializers import AnalyticsSnapshotSerializer


class AnalyticsSnapshotViewSet(viewsets.ModelViewSet):
    queryset = AnalyticsSnapshot.objects.all()
    serializer_class = AnalyticsSnapshotSerializer
    filterset_fields = ["name"]
    throttle_scope = "analytics"
