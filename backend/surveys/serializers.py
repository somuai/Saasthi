from registry.models import Patient
from rest_framework import serializers

from .models import SurveyResponse


class SurveyResponseSerializer(serializers.ModelSerializer):
    patient_local_uuid = serializers.UUIDField(write_only=True, required=False)

    class Meta:
        model = SurveyResponse
        fields = [
            "id",
            "local_uuid",
            "patient",
            "patient_local_uuid",
            "survey_type",
            "answers",
            "submitted_at",
            "synced_at",
            "score_snapshot",
            "photo_base64",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "local_uuid", "created_by", "created_at", "updated_at", "submitted_at", "synced_at"]
        extra_kwargs = {"patient": {"required": False}}

    def validate(self, attrs):
        patient_local_uuid = attrs.pop("patient_local_uuid", None)
        if patient_local_uuid:
            attrs["patient"] = Patient.objects.get(local_uuid=patient_local_uuid)
        return attrs
