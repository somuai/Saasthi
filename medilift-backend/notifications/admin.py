from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ("local_uuid", "recipient", "channel", "title", "read_at", "created_at")
    list_filter = ("channel", "read_at")
    search_fields = ("recipient__username", "recipient__phone", "title", "body")
