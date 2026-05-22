from accounts.views import audit
from registry.models import Patient
from rest_framework import viewsets
from shaasthi_backend.querysets import for_user_geography

from .models import Referral
from .serializers import ReferralSerializer


class ReferralViewSet(viewsets.ModelViewSet):
    serializer_class = ReferralSerializer
    filterset_fields = ["status", "destination"]

    def get_queryset(self):
        patient_ids = for_user_geography(Patient.objects.all(), self.request.user).values("id")
        return Referral.objects.select_related("patient", "flag").filter(patient_id__in=patient_ids)

    def perform_create(self, serializer):
        obj = serializer.save(created_by=self.request.user)
        audit(self.request, "referral.create", "Referral", obj.local_uuid)

    def perform_update(self, serializer):
        obj = serializer.save()
        audit(self.request, "referral.update", "Referral", obj.local_uuid)
