from rest_framework import serializers

from registry.models import Patient
from surveys.models import SurveyResponse

from .engine import RiskEngine, assess
from .models import RiskAssessment, RiskRule


class RiskRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = RiskRule
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "deactivated_at", "deactivated_by"]


class RiskAssessmentSerializer(serializers.ModelSerializer):
    patient_local_uuid = serializers.UUIDField(write_only=True, required=False)
    survey_response_local_uuid = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    surveyed_at = serializers.DateTimeField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = RiskAssessment
        fields = "__all__"
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
        engine = RiskEngine()
        assessment = engine.create_assessment(patient, survey, surveyed_at=surveyed_at, save=False)
        for key, value in validated_data.items():
            if key not in {"patient", "survey_response"}:
                setattr(assessment, key, value)
        assessment.save()
        return assessment
