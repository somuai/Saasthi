from flagging.models import Flag
from registry.models import Patient
from rest_framework import serializers

from .models import Referral


class ReferralSerializer(serializers.ModelSerializer):
    patient_local_uuid = serializers.UUIDField(write_only=True, required=False)
    flag_local_uuid = serializers.UUIDField(write_only=True, required=False, allow_null=True)

    patient_name = serializers.CharField(source="patient.full_name", read_only=True)
    patient_age = serializers.IntegerField(source="patient.age_years", read_only=True)
    patient_gender = serializers.CharField(source="patient.gender", read_only=True)
    patient_village = serializers.CharField(source="patient.village", read_only=True)
    patient_phone = serializers.CharField(source="patient.phone", read_only=True)
    patient_pregnancy_status = serializers.BooleanField(source="patient.pregnancy_status", read_only=True)
    patient_is_high_risk = serializers.BooleanField(source="patient.is_high_risk_pregnancy", read_only=True)

    class Meta:
        model = Referral
        fields = [
            "id",
            "local_uuid",
            "patient",
            "patient_local_uuid",
            "flag",
            "flag_local_uuid",
            "destination",
            "reason",
            "status",
            "assigned_doctor",
            "teleconsultation_scheduled_at",
            "teleconsultation_jitsi_link",
            "doctor_notes",
            "metadata",
            "created_by",
            "created_at",
            "updated_at",
            "patient_name",
            "patient_age",
            "patient_gender",
            "patient_village",
            "patient_phone",
            "patient_pregnancy_status",
            "patient_is_high_risk",
        ]
        read_only_fields = ["id", "local_uuid", "created_by", "created_at", "updated_at"]

        extra_kwargs = {"patient": {"required": False}, "flag": {"required": False}}

    def validate(self, attrs):
        patient_uuid = attrs.pop("patient_local_uuid", None)
        if patient_uuid:
            attrs["patient"] = Patient.objects.get(local_uuid=patient_uuid)
        flag_uuid = attrs.pop("flag_local_uuid", None)
        if flag_uuid:
            attrs["flag"] = Flag.objects.get(local_uuid=flag_uuid)
        return attrs
