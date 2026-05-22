from registry.models import Patient
from rest_framework import serializers

from .models import (
    ANCVisit,
    CareInteraction,
    DeliveryRecord,
    DevelopmentMilestoneCheck,
    GrowthRecord,
    IFACompliance,
    ImmunizationRecord,
    MCPSurveySession,
    PNCVisit,
)


class PatientLocalUuidMixin(serializers.ModelSerializer):
    patient_local_uuid = serializers.UUIDField(write_only=True, required=False)

    def validate(self, attrs):
        patient_uuid = attrs.pop("patient_local_uuid", None)
        if patient_uuid:
            attrs["patient"] = Patient.objects.get(local_uuid=patient_uuid)
        return attrs


class CareInteractionSerializer(PatientLocalUuidMixin):
    class Meta:
        model = CareInteraction
        fields = "__all__"
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]
        extra_kwargs = {"patient": {"required": False}}


class ANCVisitSerializer(PatientLocalUuidMixin):
    class Meta:
        model = ANCVisit
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"patient": {"required": False}, "asha_worker": {"required": False}}


class DeliveryRecordSerializer(serializers.ModelSerializer):
    mother_patient_local_uuid = serializers.UUIDField(write_only=True, required=False)
    child_patient_local_uuid = serializers.UUIDField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = DeliveryRecord
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"mother_patient": {"required": False}, "asha_worker": {"required": False},
                        "child_patient": {"required": False}}

    def validate(self, attrs):
        mother_uuid = attrs.pop("mother_patient_local_uuid", None)
        if mother_uuid:
            attrs["mother_patient"] = Patient.objects.get(local_uuid=mother_uuid)
        child_uuid = attrs.pop("child_patient_local_uuid", None)
        if child_uuid:
            attrs["child_patient"] = Patient.objects.get(local_uuid=child_uuid)
        return attrs


class PNCVisitSerializer(serializers.ModelSerializer):
    mother_patient_local_uuid = serializers.UUIDField(write_only=True, required=False)

    class Meta:
        model = PNCVisit
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"mother_patient": {"required": False}, "asha_worker": {"required": False},
                        "delivery_record": {"required": False}}

    def validate(self, attrs):
        mother_uuid = attrs.pop("mother_patient_local_uuid", None)
        if mother_uuid:
            attrs["mother_patient"] = Patient.objects.get(local_uuid=mother_uuid)
        return attrs


class GrowthRecordSerializer(PatientLocalUuidMixin):
    class Meta:
        model = GrowthRecord
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"patient": {"required": False}, "asha_worker": {"required": False}}


class DevelopmentMilestoneCheckSerializer(PatientLocalUuidMixin):
    class Meta:
        model = DevelopmentMilestoneCheck
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"patient": {"required": False}, "asha_worker": {"required": False}}


class ImmunizationRecordSerializer(PatientLocalUuidMixin):
    class Meta:
        model = ImmunizationRecord
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"patient": {"required": False}, "asha_worker": {"required": False}}


class IFAComplianceSerializer(PatientLocalUuidMixin):
    class Meta:
        model = IFACompliance
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"patient": {"required": False}, "asha_worker": {"required": False}}


class MCPSurveySessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MCPSurveySession
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]
