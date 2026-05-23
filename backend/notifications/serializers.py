from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            "id",
            "local_uuid",
            "recipient",
            "channel",
            "title",
            "body",
            "payload",
            "read_at",
            "created_at",
        ]
        read_only_fields = ["id", "local_uuid", "created_at", "recipient"]
