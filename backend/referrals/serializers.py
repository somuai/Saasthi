from flagging.models import Flag
from registry.models import Patient
from rest_framework import serializers

from .models import Referral


class ReferralSerializer(serializers.ModelSerializer):
    patient_local_uuid = serializers.UUIDField(write_only=True, required=False)
    flag_local_uuid = serializers.UUIDField(write_only=True, required=False, allow_null=True)

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
            "metadata",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "local_uuid", "created_by", "created_at", "updated_at", "status"]
        extra_kwargs = {"patient": {"required": False}, "flag": {"required": False}}

    def validate(self, attrs):
        patient_uuid = attrs.pop("patient_local_uuid", None)
        if patient_uuid:
            attrs["patient"] = Patient.objects.get(local_uuid=patient_uuid)
        flag_uuid = attrs.pop("flag_local_uuid", None)
        if flag_uuid:
            attrs["flag"] = Flag.objects.get(local_uuid=flag_uuid)
        return attrs
