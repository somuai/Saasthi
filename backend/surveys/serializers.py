from registry.models import Patient
from rest_framework import serializers

from .models import SurveyResponse


class SurveyResponseSerializer(serializers.ModelSerializer):
    patient_local_uuid = serializers.UUIDField(write_only=True, required=False)

    class Meta:
        model = SurveyResponse
        fields = "__all__"
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]
        extra_kwargs = {"patient": {"required": False}}

    def validate(self, attrs):
        patient_local_uuid = attrs.pop("patient_local_uuid", None)
        if patient_local_uuid:
            attrs["patient"] = Patient.objects.get(local_uuid=patient_local_uuid)
        return attrs
