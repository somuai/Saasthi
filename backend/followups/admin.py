from django.contrib import admin

from .models import FollowUp, VisitRecord, VisitVerificationOTP


@admin.register(FollowUp)
class FollowUpAdmin(admin.ModelAdmin):
    list_display = ("patient", "worker", "scheduled_date", "urgency", "status", "created_at")
    list_filter = ("status", "urgency", "is_auto_scheduled")
    search_fields = ("patient__full_name", "worker__phone")


@admin.register(VisitRecord)
class VisitRecordAdmin(admin.ModelAdmin):
    list_display = ("patient", "worker", "visit_date", "condition_observed", "referred_to_phc")
    list_filter = ("condition_observed", "referred_to_phc")


@admin.register(VisitVerificationOTP)
class VisitVerificationOTPAdmin(admin.ModelAdmin):
    list_display = ("patient", "asha_worker", "is_used", "attempt_count", "bypass_reason", "expires_at")
    list_filter = ("is_used", "bypass_reason")
    search_fields = ("patient__full_name", "asha_worker__phone")
    readonly_fields = ("otp_hash",)
