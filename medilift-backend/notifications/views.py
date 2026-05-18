from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Notification
from .serializers import NotificationSerializer


class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    filterset_fields = ["channel", "read_at"]

    def get_queryset(self):
        qs = Notification.objects.select_related("recipient")
        if self.request.user.role in {"admin", "supervisor", "auditor"} or self.request.user.is_superuser:
            return qs
        return qs.filter(recipient=self.request.user)

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.read_at = timezone.now()
        notification.save(update_fields=["read_at"])
        return Response(self.get_serializer(notification).data)
