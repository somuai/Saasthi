from rest_framework import serializers

from .models import IncentiveLedgerEntry


class IncentiveLedgerEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = IncentiveLedgerEntry
        fields = "__all__"
        read_only_fields = ["id", "created_at"]
