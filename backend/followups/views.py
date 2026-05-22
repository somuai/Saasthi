from rest_framework import viewsets

from shaasthi_backend.permissions import RolePermission
from .models import FollowUp, VisitRecord
from .serializers import FollowUpSerializer, VisitRecordSerializer


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
