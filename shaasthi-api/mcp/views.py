from rest_framework import viewsets

from accounts.views import audit
from shaasthi_backend.querysets import for_user_geography
from registry.models import Patient

from .models import CareInteraction
from .serializers import CareInteractionSerializer


class CareInteractionViewSet(viewsets.ModelViewSet):
    serializer_class = CareInteractionSerializer
    filterset_fields = ["protocol", "patient"]

    def get_queryset(self):
        patient_ids = for_user_geography(Patient.objects.all(), self.request.user).values("id")
        return CareInteraction.objects.select_related("patient").filter(patient_id__in=patient_ids)

    def perform_create(self, serializer):
        obj = serializer.save(created_by=self.request.user)
        audit(self.request, "mcp.care_interaction.create", "CareInteraction", obj.local_uuid)
