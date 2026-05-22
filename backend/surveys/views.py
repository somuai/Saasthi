from django.db import transaction
from rest_framework import status, viewsets
from rest_framework.response import Response

from accounts.views import audit
from registry.models import Patient
from risk_engine.hooks import enqueue_risk_assessment
from shaasthi_backend.querysets import for_user_geography
from shaasthi_backend.throttling import SurveyWriteThrottle

from .models import SurveyResponse
from .serializers import SurveyResponseSerializer


class SurveyResponseViewSet(viewsets.ModelViewSet):
    serializer_class = SurveyResponseSerializer
    filterset_fields = ["survey_type", "patient"]
    throttle_classes = [SurveyWriteThrottle]

    def get_queryset(self):
        qs = SurveyResponse.objects.select_related("patient").order_by("-updated_at")
        patient_ids = for_user_geography(
            qs.model._meta.get_field("patient").related_model.objects.all(), self.request.user
        ).values("id")
        return qs.filter(patient_id__in=patient_ids)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        patient = serializer.validated_data.get("patient")
        if patient and not for_user_geography(Patient.objects.filter(pk=patient.pk), request.user).exists():
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("No access to this patient")
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        payload = dict(serializer.data)
        payload["risk_assessment"] = "processing"
        return Response(payload, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        obj = serializer.save(created_by=self.request.user)
        audit(self.request, "survey.create", "SurveyResponse", obj.local_uuid)
        surveyed_at = obj.submitted_at.isoformat() if obj.submitted_at else None
        enqueue_risk_assessment(obj.patient_id, obj.id, surveyed_at)
