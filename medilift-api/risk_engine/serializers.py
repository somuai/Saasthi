from rest_framework import serializers

from registry.models import Patient
from surveys.models import SurveyResponse

from .engine import assess
from .models import RiskAssessment, RiskRule


class RiskRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = RiskRule
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]


class RiskAssessmentSerializer(serializers.ModelSerializer):
    patient_local_uuid = serializers.UUIDField(write_only=True, required=False)
    survey_response_local_uuid = serializers.UUIDField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = RiskAssessment
        fields = "__all__"
        read_only_fields = ["id", "total_score", "level", "explanations", "rules_version", "created_at"]
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
        result = assess(validated_data["patient"], validated_data.get("survey_response"))
        return RiskAssessment.objects.create(**validated_data, **result)
