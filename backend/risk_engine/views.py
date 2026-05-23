from accounts.views import audit
from django.utils import timezone
from flagging.services import create_flags_for_assessment
from registry.models import Patient
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from shaasthi_backend.permissions import AdminOnlyPermission
from shaasthi_backend.querysets import for_user_geography
from shaasthi_backend.throttling import GemmaQueryThrottle, RiskAssessmentThrottle
from surveys.models import SurveyResponse

from .gemma_service import gemma_service
from .models import RiskAssessment, RiskRule
from .rule_validator import RuleValidator
from .schemas_serializers import RiskAssessmentResponseSerializer, RiskRuleCreateSerializer, build_assessment_response
from .serializers import RiskAssessmentSerializer, RiskRuleSerializer


class RiskRuleViewSet(viewsets.ModelViewSet):
    queryset = RiskRule.objects.all().order_by("code")
    serializer_class = RiskRuleSerializer
    filterset_fields = ["is_active", "severity", "flag_type", "category", "is_hard_flag"]
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.action in ("list", "retrieve", "simulate"):
            return [IsAuthenticated()]
        return [IsAuthenticated(), AdminOnlyPermission()]

    def create(self, request, *args, **kwargs):
        force = request.query_params.get("force", "").lower() in {"1", "true", "yes"}
        create_serializer = RiskRuleCreateSerializer(data=request.data)
        create_serializer.is_valid(raise_exception=True)
        data = create_serializer.validated_data

        validator = RuleValidator()
        validation = validator.validate(data)
        if validation.warnings and not force:
            return Response(
                {
                    "detail": "Rule has conflicts. Review warnings or use ?force=true",
                    "warnings": [w.to_dict() for w in validation.warnings],
                },
                status=status.HTTP_409_CONFLICT,
            )

        rule = RiskRule.objects.create(
            code=data["code"],
            name=data.get("name") or data["code"],
            description=data.get("description", ""),
            field_path=data["field_path"],
            operator=data["operator"],
            value=data.get("value") or {},
            weight=data["weight"],
            category=data.get("category", RiskRule.Category.GENERAL),
            is_hard_flag=data.get("is_hard_flag", False),
            hard_flag_message_en=data.get("hard_flag_message_en", ""),
            hard_flag_message_hi=data.get("hard_flag_message_hi", ""),
            rule_label_en=data.get("rule_label_en", ""),
            rule_label_hi=data.get("rule_label_hi", ""),
            severity=data.get("severity", "medium"),
            flag_type=data.get("flag_type", "clinical_risk"),
        )
        audit(request, "risk.rule.create", "RiskRule", rule.code)
        return Response(RiskRuleSerializer(rule).data, status=status.HTTP_201_CREATED)

    def destroy(self, request, *args, **kwargs):
        rule = self.get_object()
        rule.is_active = False
        rule.deactivated_at = timezone.now()
        rule.deactivated_by = getattr(request.user, "email", None) or str(request.user)
        rule.save(update_fields=["is_active", "deactivated_at", "deactivated_by", "updated_at"])
        audit(request, "risk.rule.deactivate", "RiskRule", rule.code)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="simulate")
    def simulate(self, request):
        create_serializer = RiskRuleCreateSerializer(data=request.data)
        create_serializer.is_valid(raise_exception=True)
        data = create_serializer.validated_data
        sample_size = min(int(request.query_params.get("sample_size", 100)), 500)

        from .engine import compare, resolve_path

        surveys = list(SurveyResponse.objects.select_related("patient").order_by("-created_at")[:sample_size])
        would_fire_count = 0
        sample_matches = []

        for survey in surveys:
            patient = survey.patient
            actual_value = resolve_path(patient, survey, data["field_path"])
            expected = data.get("value") or {}
            expected_scalar = expected["value"] if isinstance(expected, dict) and "value" in expected else expected
            if compare(actual_value, data["operator"], expected_scalar):
                would_fire_count += 1
                if len(sample_matches) < 5:
                    sample_matches.append(
                        {
                            "patient_id": str(patient.local_uuid),
                            "actual_value": actual_value,
                        }
                    )

        total = len(surveys)
        return Response(
            {
                "sample_size": total,
                "would_fire_count": would_fire_count,
                "fire_rate_percent": round((would_fire_count / max(total, 1)) * 100, 1),
                "sample_matches": sample_matches,
            }
        )


class RiskAssessmentViewSet(viewsets.ModelViewSet):
    serializer_class = RiskAssessmentSerializer
    http_method_names = ["get", "post", "head", "options"]
    permission_classes = [IsAuthenticated]
    throttle_classes = [RiskAssessmentThrottle]

    def get_queryset(self):
        patient_ids = for_user_geography(Patient.objects.all(), self.request.user).values("id")
        return RiskAssessment.objects.select_related(
            "patient", "patient__household", "survey_response", "hard_flag_rule"
        ).filter(patient_id__in=patient_ids)

    def get_serializer_class(self):
        if self.action in ("retrieve", "latest"):
            return RiskAssessmentResponseSerializer
        return RiskAssessmentSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        patient = serializer.validated_data.get("patient")
        if patient and not for_user_geography(Patient.objects.filter(pk=patient.pk), request.user).exists():
            raise PermissionDenied("No access to this patient")
        assessment = serializer.save()
        flags = create_flags_for_assessment(assessment, request.user)
        audit(request, "risk.assess", "RiskAssessment", assessment.local_uuid, {"flags_created": len(flags)})
        output = build_assessment_response(assessment)
        output["flags_created"] = len(flags)
        return Response(output, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        assessment = self.get_object()
        return Response(build_assessment_response(assessment))

    @action(detail=False, methods=["get"], url_path=r"latest/(?P<patient_local_uuid>[^/.]+)")
    def latest(self, request, patient_local_uuid=None):
        try:
            patient = Patient.objects.get(local_uuid=patient_local_uuid)
        except Patient.DoesNotExist as exc:
            raise NotFound("Patient not found") from exc

        if not for_user_geography(Patient.objects.filter(pk=patient.pk), request.user).exists():
            raise PermissionDenied("No access to this patient")

        assessment = self.get_queryset().filter(patient=patient).order_by("-created_at").first()
        if not assessment:
            raise NotFound("No assessment found for this patient")
        return Response(build_assessment_response(assessment))

    @action(detail=True, methods=["post"])
    def flags(self, request, pk=None):
        assessment = self.get_object()
        flags = create_flags_for_assessment(assessment, request.user)
        return Response({"flags_created": len(flags)})

    @action(detail=False, methods=["post"], throttle_classes=[GemmaQueryThrottle])
    def gemma_query(self, request):
        patient_id = request.data.get("patient_id")
        question = request.data.get("question", "").strip()
        if not patient_id:
            return Response({"detail": "patient_id required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            patient = Patient.objects.get(pk=patient_id)
        except Patient.DoesNotExist:
            raise NotFound("Patient not found")
        if not for_user_geography(Patient.objects.filter(pk=patient.pk), request.user).exists():
            raise PermissionDenied("No access to this patient")

        latest_assessment = RiskAssessment.objects.filter(patient=patient).order_by("-created_at").first()

        patient_context = {
            "name": patient.full_name,
            "age": patient.age_years or "N/A",
            "village": patient.village or "N/A",
        }
        assessment_dict = {"level": "low", "normalized_score": 0, "explanations": []}
        if latest_assessment:
            assessment_dict = {
                "level": latest_assessment.risk_level,
                "normalized_score": latest_assessment.normalized_score,
                "explanations": [
                    {"name": r.get("rule_label_en", r.get("name", "")), "rule_label_hi": r.get("rule_label_hi", "")}
                    for r in latest_assessment.explanations
                ],
                "triggered_by_hard_flag": latest_assessment.triggered_by_hard_flag,
            }

        population = "maternal" if patient.pregnancy_status else "general"
        photo_base64 = request.data.get("photo_base64")

        recommendation = gemma_service.generate(
            patient_context,
            assessment_dict,
            photo_base64,
            population,
        )
        if not recommendation:
            return Response(
                {"detail": "AI recommendation unavailable. Try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        response_data = {
            "patient_id": patient.id,
            "patient_name": patient.full_name,
            "question": question or None,
            "recommendation": recommendation,
        }
        audit(request, "risk.gemma_query", "Patient", patient.local_uuid)
        return Response(response_data)
