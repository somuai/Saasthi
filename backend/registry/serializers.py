from accounts.models import User
from rest_framework import serializers

from .models import Household, Patient


class HouseholdSerializer(serializers.ModelSerializer):
    class Meta:
        model = Household
        fields = [
            "id",
            "local_uuid",
            "household_code",
            "head_name",
            "head_name_hi",
            "region",
            "district",
            "block",
            "village",
            "address",
            "lat",
            "lng",
            "member_count",
            "is_active",
            "metadata",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "local_uuid", "created_by", "created_at", "updated_at", "is_active"]


class PatientSerializer(serializers.ModelSerializer):
    age_years = serializers.IntegerField(read_only=True, allow_null=True)
    household_local_uuid = serializers.UUIDField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Patient
        fields = [
            "id",
            "local_uuid",
            "household",
            "household_local_uuid",
            "full_name",
            "name_hi",
            "phone",
            "gender",
            "date_of_birth",
            "age_years",
            "relationship_to_head",
            "region",
            "district",
            "block",
            "village",
            "status",
            "asha_worker",
            "diabetes",
            "hypertension",
            "tb_history",
            "prev_hospitalized",
            "pregnancy_status",
            "prev_high_risk_count",
            "mcts_rch_id",
            "mcp_card_issued",
            "mcp_card_number",
            "pmmvy_eligible",
            "bank_account_number",
            "bank_ifsc",
            "bank_branch_name",
            "gravida",
            "para",
            "last_delivery_date",
            "last_delivery_place",
            "obstetric_complications",
            "past_medical_history",
            "lmp_date",
            "edd",
            "is_high_risk_pregnancy",
            "anc_visit_count",
            "mother_patient",
            "birth_weight_kg",
            "birth_place",
            "birth_registration_number",
            "abha_number",
            "abha_consent_given",
            "fhir_bundle",
            "metadata",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "local_uuid",
            "age_years",
            "created_by",
            "created_at",
            "updated_at",
            "asha_worker",
            "status",
            "is_high_risk_pregnancy",
            "bank_account_number",
            "bank_ifsc",
            "bank_branch_name",
            "abha_number",
            "mcts_rch_id",
            "mcp_card_number",
            "mcp_card_issued",
            "pmmvy_eligible",
            "fhir_bundle",
            "metadata",
        ]

    def validate(self, attrs):
        household_local_uuid = attrs.pop("household_local_uuid", None)
        if household_local_uuid:
            attrs["household"] = Household.objects.get(local_uuid=household_local_uuid)

        request = self.context.get("request")
        if request and request.user.is_authenticated and request.user.role == User.Role.HEALTH_WORKER:
            user = request.user
            if not any(getattr(user, field, "") for field in ("village", "block", "district", "region")):
                raise serializers.ValidationError(
                    "ASHA worker geography (village/block/district) must be set before registering patients."
                )
        return attrs


class MapPatientSerializer(serializers.ModelSerializer):
    household_lat = serializers.FloatField(source="household.lat", read_only=True, allow_null=True)
    household_lng = serializers.FloatField(source="household.lng", read_only=True, allow_null=True)

    class Meta:
        model = Patient
        fields = [
            "id",
            "local_uuid",
            "full_name",
            "phone",
            "gender",
            "age_years",
            "village",
            "status",
            "pregnancy_status",
            "household_lat",
            "household_lng",
        ]
