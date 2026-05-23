from rest_framework import serializers

from .models import SyncEvent


class SyncEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = SyncEvent
        fields = "__all__"
        read_only_fields = ["id", "received_at"]


MODEL_CHOICES = [
    "patient",
    "household",
    "survey_response",
    "follow_up",
    "flag",
    "referral",
    "care_interaction",
    "incentive_ledger_entry",
]


class SyncChangeSerializer(serializers.Serializer):
    event_uuid = serializers.UUIDField(required=False, allow_null=True)
    model = serializers.ChoiceField(choices=MODEL_CHOICES)
    local_uuid = serializers.UUIDField()
    deleted = serializers.BooleanField(default=False, required=False)
    data = serializers.DictField(default=dict, required=False)


class SyncPushSerializer(serializers.Serializer):
    client_id = serializers.CharField(max_length=120)
    changes = SyncChangeSerializer(many=True)


class SyncPullSerializer(serializers.Serializer):
    since = serializers.DateTimeField(required=False, allow_null=True)
