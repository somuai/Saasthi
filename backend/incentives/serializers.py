from rest_framework import serializers

from .models import ASHAWorkerProfile, IncentiveLedgerEntry, IncentiveRate


class IncentiveLedgerEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = IncentiveLedgerEntry
        fields = [
            "id",
            "local_uuid",
            "worker",
            "category",
            "description",
            "amount",
            "activity_type",
            "amount_paise",
            "status",
            "reference_id",
            "reference_type",
            "approved_by",
            "approved_at",
            "paid_at",
            "month_year",
            "description_en",
            "description_hi",
            "metadata",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "local_uuid",
            "created_at",
            "worker",
            "amount",
            "amount_paise",
            "status",
            "approved_by",
            "approved_at",
            "paid_at",
        ]


class IncentiveRateSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncentiveRate
        fields = ["id", "activity_type", "amount_paise", "label_en", "label_hi", "is_active"]


class ASHAWorkerProfileSerializer(serializers.ModelSerializer):
    user_details = serializers.SerializerMethodField()

    class Meta:
        model = ASHAWorkerProfile
        fields = [
            "id",
            "user",
            "asha_id",
            "husband_name",
            "bank_details",
            "is_active",
            "user_details",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "user_details"]

    def get_user_details(self, obj):
        return {
            "name": obj.user.get_full_name(),
            "phone": obj.user.phone,
            "district": obj.user.district,
            "block": obj.user.block,
            "village": obj.user.village,
            "region": getattr(obj.user, "region", None),
        }

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        request = self.context.get("request")
        user = request.user if request else None
        bank_details = representation.get("bank_details")
        if bank_details and isinstance(bank_details, dict):
            account_number = bank_details.get("account_number")
            if account_number and len(str(account_number)) > 4:
                is_privileged = user and (user.is_superuser or user.role in {"admin", "supervisor", "auditor"})
                if not is_privileged:
                    representation["bank_details"] = {
                        **bank_details,
                        "account_number": f"{'X' * (len(str(account_number)) - 4)}{str(account_number)[-4:]}",
                    }
        return representation


class MonthlySummarySerializer(serializers.Serializer):
    worker_id = serializers.IntegerField()
    worker_name = serializers.CharField()
    month_year = serializers.CharField()
    total_paise = serializers.IntegerField()
    total_rupees = serializers.DecimalField(max_digits=12, decimal_places=2)
    entries_count = serializers.IntegerField()
    by_category = serializers.DictField(child=serializers.IntegerField())
