from django.contrib import admin

from .models import ASHAWorkerProfile, IncentiveLedgerEntry, IncentiveRate


@admin.register(IncentiveLedgerEntry)
class IncentiveLedgerEntryAdmin(admin.ModelAdmin):
    list_display = ("local_uuid", "worker", "activity_type", "amount_rupees", "status", "month_year", "created_at")
    list_filter = ("activity_type", "status")
    search_fields = ("worker__username", "worker__phone", "description_en", "description_hi")
    actions = ["approve_entries", "mark_entries_paid"]

    @admin.action(description="Approve selected entries")
    def approve_entries(self, request, queryset):
        from django.utils import timezone

        updated = queryset.filter(status=IncentiveLedgerEntry.Status.PENDING).update(
            status=IncentiveLedgerEntry.Status.APPROVED,
            approved_by=str(request.user),
            approved_at=timezone.now(),
        )
        self.message_user(request, f"{updated} entries approved.")

    @admin.action(description="Mark selected entries as paid")
    def mark_entries_paid(self, request, queryset):
        from django.utils import timezone

        updated = queryset.filter(status=IncentiveLedgerEntry.Status.APPROVED).update(
            status=IncentiveLedgerEntry.Status.PAID,
            paid_at=timezone.now(),
        )
        self.message_user(request, f"{updated} entries marked paid.")


@admin.register(IncentiveRate)
class IncentiveRateAdmin(admin.ModelAdmin):
    list_display = ("activity_type", "amount_rupees", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("activity_type", "label_en", "label_hi")


@admin.register(ASHAWorkerProfile)
class ASHAWorkerProfileAdmin(admin.ModelAdmin):
    list_display = ("asha_id", "user", "husband_name", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("asha_id", "user__username", "user__phone", "husband_name")
    raw_id_fields = ("user",)
