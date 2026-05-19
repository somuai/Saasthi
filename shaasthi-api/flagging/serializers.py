from rest_framework import serializers

from registry.models import Patient

from .models import Flag
from .services import dedupe_key


class FlagSerializer(serializers.ModelSerializer):
    patient_local_uuid = serializers.UUIDField(write_only=True, required=False)

    class Meta:
        model = Flag
        fields = "__all__"
        read_only_fields = ["id", "dedupe_key", "created_by", "created_at", "updated_at"]
        extra_kwargs = {"patient": {"required": False}}

    def validate(self, attrs):
        patient_uuid = attrs.pop("patient_local_uuid", None)
        if patient_uuid:
            attrs["patient"] = Patient.objects.get(local_uuid=patient_uuid)
        return attrs

    def create(self, validated_data):
        if not validated_data.get("dedupe_key"):
            validated_data["dedupe_key"] = dedupe_key(
                validated_data["patient"],
                validated_data["flag_type"],
                validated_data.get("source", "manual"),
            )
        flag, _ = Flag.objects.get_or_create(dedupe_key=validated_data["dedupe_key"], defaults=validated_data)
        return flag
