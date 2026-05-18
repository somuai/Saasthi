from django.contrib import admin

from .models import SurveyResponse


@admin.register(SurveyResponse)
class SurveyResponseAdmin(admin.ModelAdmin):
    list_display = ("local_uuid", "patient", "survey_type", "submitted_at", "updated_at")
    list_filter = ("survey_type",)
    search_fields = ("local_uuid", "patient__full_name")
