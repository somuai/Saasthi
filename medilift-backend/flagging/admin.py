from django.contrib import admin

from .models import Flag


@admin.register(Flag)
class FlagAdmin(admin.ModelAdmin):
    list_display = ("local_uuid", "patient", "flag_type", "source", "severity", "status", "updated_at")
    list_filter = ("flag_type", "source", "severity", "status")
    search_fields = ("local_uuid", "patient__full_name", "dedupe_key")
