from django.contrib import admin

from .models import AnalyticsSnapshot


@admin.register(AnalyticsSnapshot)
class AnalyticsSnapshotAdmin(admin.ModelAdmin):
    list_display = ("local_uuid", "name", "created_at")
    search_fields = ("name",)
