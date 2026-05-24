from django.contrib import admin

from .models import (
    ANCVisit,
    CareInteraction,
    DeliveryRecord,
    DevelopmentMilestoneCheck,
    GrowthRecord,
    IFACompliance,
    ImmunizationRecord,
    MCPSurveySession,
    PNCVisit,
    WHOGrowthReference,
)


@admin.register(CareInteraction)
class CareInteractionAdmin(admin.ModelAdmin):
    list_display = ("local_uuid", "patient", "protocol", "occurred_at", "created_by")
    list_filter = ("protocol",)
    search_fields = ("local_uuid", "patient__full_name", "notes")


@admin.register(ANCVisit)
class ANCVisitAdmin(admin.ModelAdmin):
    list_display = ("local_uuid", "patient", "visit_number", "visit_date", "is_high_risk")
    list_filter = ("is_high_risk", "visit_number")
    search_fields = ("local_uuid", "patient__full_name", "asha_worker__phone")
    readonly_fields = ("local_uuid", "created_at", "updated_at")


@admin.register(DeliveryRecord)
class DeliveryRecordAdmin(admin.ModelAdmin):
    list_display = ("local_uuid", "mother_patient", "delivery_date", "delivery_type", "jsy_registered")
    list_filter = ("delivery_type", "delivery_place", "jsy_registered", "pmmvy_registered")
    search_fields = ("local_uuid", "mother_patient__full_name", "institution_name")
    readonly_fields = ("local_uuid", "created_at", "updated_at")


@admin.register(PNCVisit)
class PNCVisitAdmin(admin.ModelAdmin):
    list_display = ("local_uuid", "mother_patient", "visit_timing", "visit_date", "is_extra_visit")
    list_filter = ("visit_timing", "is_extra_visit")
    search_fields = ("local_uuid", "mother_patient__full_name", "delivery_record__local_uuid")
    readonly_fields = ("local_uuid", "created_at", "updated_at")


@admin.register(GrowthRecord)
class GrowthRecordAdmin(admin.ModelAdmin):
    list_display = ("local_uuid", "patient", "recorded_date", "age_completed_months", "nutritional_status", "is_faltering")
    list_filter = ("nutritional_status", "is_faltering", "recorded_date")
    search_fields = ("local_uuid", "patient__full_name", "aww_notes")
    readonly_fields = ("local_uuid", "created_at", "updated_at")


@admin.register(DevelopmentMilestoneCheck)
class DevelopmentMilestoneCheckAdmin(admin.ModelAdmin):
    list_display = ("local_uuid", "patient", "check_date", "age_at_check_months", "any_warning_sign")
    list_filter = ("any_warning_sign", "age_at_check_months")
    search_fields = ("local_uuid", "patient__full_name", "developmental_concern")
    readonly_fields = ("local_uuid", "created_at", "updated_at")


@admin.register(ImmunizationRecord)
class ImmunizationRecordAdmin(admin.ModelAdmin):
    list_display = ("local_uuid", "patient", "vaccine_name", "dose_number", "status", "scheduled_date")
    list_filter = ("status", "vaccine_name", "dose_number")
    search_fields = ("local_uuid", "patient__full_name", "administered_at")
    readonly_fields = ("local_uuid", "created_at", "updated_at")


@admin.register(IFACompliance)
class IFAComplianceAdmin(admin.ModelAdmin):
    list_display = ("local_uuid", "patient", "year_month", "week_number", "dose_given", "albendazole_given")
    list_filter = ("year_month", "dose_given", "albendazole_given")
    search_fields = ("local_uuid", "patient__full_name")
    readonly_fields = ("local_uuid", "created_at", "updated_at")


@admin.register(MCPSurveySession)
class MCPSurveySessionAdmin(admin.ModelAdmin):
    list_display = ("local_uuid", "patient", "session_date", "session_type", "asha_worker")
    list_filter = ("session_type", "session_date")
    search_fields = ("local_uuid", "patient__full_name", "linked_record_id")
    readonly_fields = ("local_uuid", "created_at", "updated_at")


@admin.register(WHOGrowthReference)
class WHOGrowthReferenceAdmin(admin.ModelAdmin):
    list_display = ("sex", "age_months", "measurement_type", "median", "sd_minus_2", "sd_plus_2")
    list_filter = ("sex", "measurement_type")
    readonly_fields = ("created_at",)
