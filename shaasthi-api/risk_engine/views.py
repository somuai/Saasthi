from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.views import audit
from flagging.services import create_flags_for_assessment
from shaasthi_backend.querysets import for_user_geography
from registry.models import Patient

from .models import RiskAssessment, RiskRule
from .serializers import RiskAssessmentSerializer, RiskRuleSerializer


class RiskRuleViewSet(viewsets.ModelViewSet):
    queryset = RiskRule.objects.all().order_by("code")
    serializer_class = RiskRuleSerializer
    filterset_fields = ["is_active", "severity", "flag_type"]


class RiskAssessmentViewSet(viewsets.ModelViewSet):
    serializer_class = RiskAssessmentSerializer
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        patient_ids = for_user_geography(Patient.objects.all(), self.request.user).values("id")
        return RiskAssessment.objects.select_related("patient", "survey_response").filter(patient_id__in=patient_ids)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assessment = serializer.save()
        flags = create_flags_for_assessment(assessment, request.user)
        audit(request, "risk.assess", "RiskAssessment", assessment.local_uuid, {"flags_created": len(flags)})
        output = self.get_serializer(assessment).data
        output["flags_created"] = len(flags)
        return Response(output, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def flags(self, request, pk=None):
        assessment = self.get_object()
        flags = create_flags_for_assessment(assessment, request.user)
        return Response({"flags_created": len(flags)})
