from accounts.models import User
from accounts.views import audit
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from shaasthi_backend.querysets import for_user_geography

from .models import Household, Patient
from .serializers import HouseholdSerializer, MapPatientSerializer, PatientSerializer
from .services.abdm_service import build_fhir_patient_bundle


class HouseholdViewSet(viewsets.ModelViewSet):
    serializer_class = HouseholdSerializer
    filterset_fields = ["region", "district", "block", "village"]

    def get_queryset(self):
        return for_user_geography(Household.objects.all().order_by("-updated_at"), self.request.user)

    def perform_create(self, serializer):
        obj = serializer.save(created_by=self.request.user)
        audit(self.request, "household.create", "Household", obj.local_uuid)

    @action(detail=True, methods=["patch"])
    def location(self, request, pk=None):
        household = self.get_object()
        lat = request.data.get("lat")
        lng = request.data.get("lng")
        if lat is None or lng is None:
            return Response({"detail": "lat and lng are required."}, status=status.HTTP_400_BAD_REQUEST)
        household.lat = lat
        household.lng = lng
        household.save(update_fields=["lat", "lng"])
        audit(request, "household.location", "Household", household.local_uuid)
        return Response({"detail": "Location saved.", "lat": lat, "lng": lng})


class PatientViewSet(viewsets.ModelViewSet):
    serializer_class = PatientSerializer
    filterset_fields = ["gender", "status", "region", "district", "block", "village"]
    search_fields = ["full_name", "phone"]

    def get_queryset(self):
        return for_user_geography(Patient.objects.all().order_by("-updated_at"), self.request.user)

    def perform_create(self, serializer):
        kwargs = {"created_by": self.request.user}
        if self.request.user.role == User.Role.HEALTH_WORKER:
            kwargs["asha_worker"] = self.request.user
        obj = serializer.save(**kwargs)
        audit(self.request, "patient.create", "Patient", obj.local_uuid)

    def perform_update(self, serializer):
        obj = serializer.save()
        audit(self.request, "patient.update", "Patient", obj.local_uuid)

    @action(detail=True, methods=["get"])
    def fhir(self, request, pk=None):
        patient = self.get_object()
        bundle = build_fhir_patient_bundle(patient)
        return Response(bundle)

    @action(detail=False, methods=["get"])
    def map_data(self, request):
        qs = self.get_queryset().select_related("household").filter(
            household__lat__isnull=False, household__lng__isnull=False,
        )
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = MapPatientSerializer(page, many=True, context={"request": request})
            return self.get_paginated_response(serializer.data)
        serializer = MapPatientSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)
