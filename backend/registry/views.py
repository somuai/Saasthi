from rest_framework import viewsets

from accounts.views import audit
from shaasthi_backend.querysets import for_user_geography

from .models import Household, Patient
from .serializers import HouseholdSerializer, PatientSerializer


class HouseholdViewSet(viewsets.ModelViewSet):
    serializer_class = HouseholdSerializer
    filterset_fields = ["region", "district", "block", "village"]

    def get_queryset(self):
        return for_user_geography(Household.objects.all().order_by("-updated_at"), self.request.user)

    def perform_create(self, serializer):
        obj = serializer.save(created_by=self.request.user)
        audit(self.request, "household.create", "Household", obj.local_uuid)


class PatientViewSet(viewsets.ModelViewSet):
    serializer_class = PatientSerializer
    filterset_fields = ["gender", "status", "region", "district", "block", "village"]
    search_fields = ["full_name", "phone"]

    def get_queryset(self):
        return for_user_geography(Patient.objects.all().order_by("-updated_at"), self.request.user)

    def perform_create(self, serializer):
        obj = serializer.save(created_by=self.request.user)
        audit(self.request, "patient.create", "Patient", obj.local_uuid)

    def perform_update(self, serializer):
        obj = serializer.save()
        audit(self.request, "patient.update", "Patient", obj.local_uuid)
