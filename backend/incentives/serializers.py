from rest_framework import serializers

from .models import IncentiveLedgerEntry, IncentiveRate


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
