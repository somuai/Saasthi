"""DRF serializers for risk engine v2 API contracts."""

from rest_framework import serializers

from registry.models import Patient

from .models import RiskAssessment, RiskRule


class RiskRuleCreateSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=80)
    name = serializers.CharField(max_length=160, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    field_path = serializers.CharField(max_length=180)
    operator = serializers.ChoiceField(choices=RiskRule.Operator.choices)
    value = serializers.JSONField(required=False, default=dict)
    weight = serializers.IntegerField(min_value=1, max_value=20, default=1)
    category = serializers.ChoiceField(choices=RiskRule.Category.choices, default=RiskRule.Category.GENERAL)
    is_hard_flag = serializers.BooleanField(default=False)
    hard_flag_message_en = serializers.CharField(required=False, allow_blank=True)
    hard_flag_message_hi = serializers.CharField(required=False, allow_blank=True)
    rule_label_en = serializers.CharField(required=False, allow_blank=True, max_length=200)
    rule_label_hi = serializers.CharField(required=False, allow_blank=True, max_length=200)
    severity = serializers.CharField(required=False, default="medium")
    flag_type = serializers.CharField(required=False, default="clinical_risk")


class RiskRuleReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = RiskRule
        fields = "__all__"


class RecommendedActionSerializer(serializers.Serializer):
    en = serializers.CharField()
    hi = serializers.CharField()
    urgency = serializers.CharField()


class AssessmentCategoriesSerializer(serializers.Serializer):
    primary = serializers.CharField()
    secondary = serializers.ListField(child=serializers.CharField())


class RiskAssessmentResponseSerializer(serializers.Serializer):
    assessment_id = serializers.UUIDField(source="local_uuid")
    patient_id = serializers.SerializerMethodField()
    patient_name = serializers.SerializerMethodField()
    household_id = serializers.SerializerMethodField()
    surveyed_at = serializers.DateTimeField(allow_null=True)
    assessed_at = serializers.DateTimeField(source="created_at")

    risk_level = serializers.CharField(source="level")
    raw_score = serializers.IntegerField(source="total_score")
    normalized_score = serializers.IntegerField(allow_null=True)
    triggered_by_hard_flag = serializers.BooleanField()
    hard_flag_message = serializers.SerializerMethodField()
    hard_flag_message_hi = serializers.SerializerMethodField()

    categories = serializers.SerializerMethodField()
    explanations = serializers.JSONField()
    recommended_action = serializers.SerializerMethodField()
    recommendation_source = serializers.CharField()
    score_source = serializers.CharField()

    def get_patient_id(self, obj):
        return str(obj.patient.local_uuid)

    def get_patient_name(self, obj):
        return obj.patient.full_name

    def get_household_id(self, obj):
        if obj.patient.household_id:
            return str(obj.patient.household.local_uuid)
        return ""

    def get_hard_flag_message(self, obj):
        if obj.triggered_by_hard_flag and obj.hard_flag_rule:
            return obj.hard_flag_rule.hard_flag_message_en
        return None

    def get_hard_flag_message_hi(self, obj):
        if obj.triggered_by_hard_flag and obj.hard_flag_rule:
            return obj.hard_flag_rule.hard_flag_message_hi
        return None

    def get_categories(self, obj):
        return {
            "primary": obj.primary_category,
            "secondary": obj.secondary_categories or [],
        }

    def get_recommended_action(self, obj):
        return {
            "en": obj.recommended_action_en,
            "hi": obj.recommended_action_hi,
            "urgency": obj.recommended_urgency,
        }


def build_assessment_response(assessment: RiskAssessment) -> dict:
    assessment = (
        RiskAssessment.objects.select_related("patient", "patient__household", "hard_flag_rule")
        .get(pk=assessment.pk)
    )
    data = RiskAssessmentResponseSerializer(assessment).data
    # Backward-compatible aliases for legacy clients
    data["total_score"] = data["raw_score"]
    data["level"] = data["risk_level"]
    data["rules_snapshot"] = assessment.rules_snapshot or []
    return data
