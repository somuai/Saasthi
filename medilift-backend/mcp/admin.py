from django.contrib import admin

from .models import CareInteraction


@admin.register(CareInteraction)
class CareInteractionAdmin(admin.ModelAdmin):
    list_display = ("local_uuid", "patient", "protocol", "occurred_at", "created_by")
    list_filter = ("protocol",)
    search_fields = ("local_uuid", "patient__full_name", "notes")
