from django.contrib import admin

from .models import RiskAssessment, RiskRule


@admin.register(RiskRule)
class RiskRuleAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "field_path", "operator", "weight", "severity", "is_active", "version")
    list_filter = ("is_active", "severity", "flag_type")
    search_fields = ("code", "name", "description")


@admin.register(RiskAssessment)
class RiskAssessmentAdmin(admin.ModelAdmin):
    list_display = ("local_uuid", "patient", "total_score", "level", "created_at")
    list_filter = ("level",)
    search_fields = ("local_uuid", "patient__full_name")
