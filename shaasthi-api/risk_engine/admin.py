from django.contrib import admin

from .models import RiskAssessment, RiskRule


@admin.register(RiskRule)
class RiskRuleAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "name",
        "field_path",
        "operator",
        "weight",
        "severity",
        "category",
        "is_hard_flag",
        "is_active",
        "version",
    )
    list_filter = ("is_active", "severity", "flag_type", "category", "is_hard_flag")
    search_fields = ("code", "name", "description", "rule_label_en")
    readonly_fields = ("deactivated_at", "deactivated_by")


@admin.register(RiskAssessment)
class RiskAssessmentAdmin(admin.ModelAdmin):
    list_display = (
        "local_uuid",
        "patient",
        "total_score",
        "normalized_score",
        "level",
        "primary_category",
        "triggered_by_hard_flag",
        "created_at",
    )
    list_filter = ("level", "primary_category", "triggered_by_hard_flag")
    search_fields = ("local_uuid", "patient__full_name")
    readonly_fields = ("rules_snapshot",)
