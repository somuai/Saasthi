from rest_framework import viewsets

from accounts.views import audit
from medilift_backend.querysets import for_user_geography

from .models import SurveyResponse
from .serializers import SurveyResponseSerializer


class SurveyResponseViewSet(viewsets.ModelViewSet):
    serializer_class = SurveyResponseSerializer
    filterset_fields = ["survey_type", "patient"]

    def get_queryset(self):
        qs = SurveyResponse.objects.select_related("patient").order_by("-updated_at")
        patient_ids = for_user_geography(qs.model._meta.get_field("patient").related_model.objects.all(), self.request.user).values("id")
        return qs.filter(patient_id__in=patient_ids)

    def perform_create(self, serializer):
        obj = serializer.save(created_by=self.request.user)
        audit(self.request, "survey.create", "SurveyResponse", obj.local_uuid)
