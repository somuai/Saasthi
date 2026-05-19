from rest_framework import serializers

from registry.models import Patient

from .models import CareInteraction


class CareInteractionSerializer(serializers.ModelSerializer):
    patient_local_uuid = serializers.UUIDField(write_only=True, required=False)

    class Meta:
        model = CareInteraction
        fields = "__all__"
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]
        extra_kwargs = {"patient": {"required": False}}

    def validate(self, attrs):
        patient_uuid = attrs.pop("patient_local_uuid", None)
        if patient_uuid:
            attrs["patient"] = Patient.objects.get(local_uuid=patient_uuid)
        return attrs
