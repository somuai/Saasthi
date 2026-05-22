from accounts.views import audit
from registry.models import Patient
from rest_framework import viewsets
from shaasthi_backend.querysets import for_user_geography

from .models import Flag
from .serializers import FlagSerializer


class FlagViewSet(viewsets.ModelViewSet):
    serializer_class = FlagSerializer
    filterset_fields = ["flag_type", "source", "severity", "status"]

    def get_queryset(self):
        patient_ids = for_user_geography(Patient.objects.all(), self.request.user).values("id")
        return Flag.objects.select_related("patient").filter(patient_id__in=patient_ids)

    def perform_create(self, serializer):
        obj = serializer.save(created_by=self.request.user)
        audit(self.request, "flag.create", "Flag", obj.local_uuid)

    def perform_update(self, serializer):
        obj = serializer.save()
        audit(self.request, "flag.update", "Flag", obj.local_uuid)
