from rest_framework import serializers

from .models import Household, Patient


class HouseholdSerializer(serializers.ModelSerializer):
    class Meta:
        model = Household
        fields = "__all__"
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]


class PatientSerializer(serializers.ModelSerializer):
    age_years = serializers.IntegerField(read_only=True, allow_null=True)
    household_local_uuid = serializers.UUIDField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Patient
        fields = "__all__"
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]

    def validate(self, attrs):
        household_local_uuid = attrs.pop("household_local_uuid", None)
        if household_local_uuid:
            attrs["household"] = Household.objects.get(local_uuid=household_local_uuid)
        return attrs
