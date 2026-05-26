from registry.models import Patient
from rest_framework import serializers
from surveys.models import SurveyResponse

from .engine import RiskEngine
from .models import RiskAssessment, RiskRule


class RiskRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = RiskRule
        fields = [
            "id",
            "code",
            "name",
            "description",
            "field_path",
            "operator",
            "value",
            "weight",
            "severity",
            "flag_type",
            "is_active",
            "version",
            "is_hard_flag",
            "hard_flag_message_en",
            "hard_flag_message_hi",
            "category",
            "deactivated_at",
            "deactivated_by",
            "rule_label_en",
            "rule_label_hi",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "deactivated_at", "deactivated_by", "is_active"]


class RiskAssessmentSerializer(serializers.ModelSerializer):
    patient_local_uuid = serializers.UUIDField(write_only=True, required=False)
    survey_response_local_uuid = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    surveyed_at = serializers.DateTimeField(required=False, allow_null=True, write_only=True)
    mcp_instance_local_uuid = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    mcp_instance_model = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = RiskAssessment
        fields = [
            "id",
            "local_uuid",
            "patient",
            "patient_local_uuid",
            "survey_response",
            "survey_response_local_uuid",
            "total_score",
            "level",
            "explanations",
            "rules_version",
            "rules_snapshot",
            "triggered_by_hard_flag",
            "hard_flag_rule",
            "normalized_score",
            "primary_category",
            "secondary_categories",
            "surveyed_at",
            "recommended_action_en",
            "recommended_action_hi",
            "recommended_urgency",
            "recommendation_source",
            "score_source",
            "rule_engine_score",
            "ml_score",
            "ml_confidence",
            "ml_model_version",
            "patient_population",
            "mcp_session_type",
            "feature_vector",
            "mcp_instance_local_uuid",
            "mcp_instance_model",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "local_uuid",
            "total_score",
            "level",
            "explanations",
            "rules_version",
            "rules_snapshot",
            "triggered_by_hard_flag",
            "hard_flag_rule",
            "normalized_score",
            "primary_category",
            "secondary_categories",
            "recommended_action_en",
            "recommended_action_hi",
            "recommended_urgency",
            "recommendation_source",
            "score_source",
            "rule_engine_score",
            "ml_score",
            "ml_confidence",
            "ml_model_version",
            "created_at",
        ]
        extra_kwargs = {"patient": {"required": False}, "survey_response": {"required": False}}

    def validate(self, attrs):
        patient_local_uuid = attrs.pop("patient_local_uuid", None)
        if patient_local_uuid:
            attrs["patient"] = Patient.objects.get(local_uuid=patient_local_uuid)
        survey_uuid = attrs.pop("survey_response_local_uuid", None)
        if survey_uuid:
            attrs["survey_response"] = SurveyResponse.objects.get(local_uuid=survey_uuid)
        return attrs

    def create(self, validated_data):
        surveyed_at = validated_data.pop("surveyed_at", None)
        patient = validated_data["patient"]
        survey = validated_data.get("survey_response")
        if surveyed_at is None and survey and survey.submitted_at:
            surveyed_at = survey.submitted_at

        mcp_instance = None
        mcp_uuid = validated_data.pop("mcp_instance_local_uuid", None)
        mcp_model = validated_data.pop("mcp_instance_model", None)
        if mcp_uuid and mcp_model:
            try:
                from .tasks import _get_instance
                mcp_instance = _get_instance(str(mcp_uuid), mcp_model)
            except Exception:
                pass

        engine = RiskEngine()
        assessment = engine.create_assessment(patient, survey, surveyed_at=surveyed_at, save=False, mcp_instance=mcp_instance)
        for key, value in validated_data.items():
            if key not in {"patient", "survey_response"}:
                setattr(assessment, key, value)
        assessment.save()
        return assessment
