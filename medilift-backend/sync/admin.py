from django.contrib import admin

from .models import SyncEvent


@admin.register(SyncEvent)
class SyncEventAdmin(admin.ModelAdmin):
    list_display = ("local_uuid", "client_id", "model_name", "object_local_uuid", "status", "received_at")
    list_filter = ("status", "model_name", "client_id")
    search_fields = ("local_uuid", "object_local_uuid", "payload_hash")
