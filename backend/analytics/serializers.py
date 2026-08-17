from rest_framework import serializers

from .models import AnalyticsSnapshot


class AnalyticsSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalyticsSnapshot
        fields = ["id", "local_uuid", "name", "metrics", "created_at"]
        read_only_fields = ["id", "created_at"]
