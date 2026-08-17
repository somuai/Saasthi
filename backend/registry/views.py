from accounts.models import User
from accounts.views import audit
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from shaasthi_backend.querysets import for_user_geography

from .models import Household, Patient
from .serializers import (
    HouseholdSerializer,
    MapPatientSerializer,
    PatientReassignSerializer,
    PatientSerializer,
)
from .services.abdm_service import build_fhir_patient_bundle


class HouseholdViewSet(viewsets.ModelViewSet):
    serializer_class = HouseholdSerializer
    filterset_fields = ["region", "district", "block", "village"]
    throttle_scope = "registry_write"

    def get_queryset(self):
        return for_user_geography(
            Household.objects.select_related("created_by").all().order_by("-updated_at"), self.request.user
        )

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
    throttle_scope = "registry_write"

    def get_queryset(self):
        return for_user_geography(
            Patient.objects.select_related("household", "asha_worker", "mother_patient", "created_by")
            .all()
            .order_by("-updated_at"),
            self.request.user,
        )

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

    @action(detail=False, methods=["post"], url_path="reassign")
    def reassign(self, request):
        if request.user.role not in (User.Role.SUPERVISOR, User.Role.ADMIN, User.Role.AUDITOR):
            raise PermissionDenied("Only supervisors and admins can reassign patients.")
        serializer = PatientReassignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        patient_ids = serializer.validated_data["patient_ids"]
        new_asha_id = serializer.validated_data["new_asha_id"]

        new_asha = get_object_or_404(User, pk=new_asha_id, role=User.Role.HEALTH_WORKER)
        patients = list(self.get_queryset().filter(pk__in=patient_ids))
        if not patients:
            raise NotFound("No patients found matching the given IDs.")

        for patient in patients:
            old_asha_id = patient.asha_worker_id
            patient.asha_worker = new_asha
            patient.save(update_fields=["asha_worker"])
            audit(
                request,
                "patient.reassign",
                "Patient",
                patient.local_uuid,
                {"from_asha": old_asha_id, "to_asha": new_asha_id},
            )

        return Response(
            {
                "detail": (f"{len(patients)} patient(s) reassigned to {new_asha.get_full_name() or new_asha.phone}."),
                "new_asha_id": new_asha.pk,
                "reassigned_count": len(patients),
            }
        )

    @action(detail=False, methods=["get"])
    def map_data(self, request):
        qs = (
            self.get_queryset()
            .select_related("household")
            .filter(
                household__lat__isnull=False,
                household__lng__isnull=False,
            )
        )
        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = MapPatientSerializer(page, many=True, context={"request": request})
            return self.get_paginated_response(serializer.data)
        serializer = MapPatientSerializer(qs, many=True, context={"request": request})
        return Response(serializer.data)
