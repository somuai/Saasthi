from django.contrib import admin

from .models import IncentiveLedgerEntry


@admin.register(IncentiveLedgerEntry)
class IncentiveLedgerEntryAdmin(admin.ModelAdmin):
    list_display = ("local_uuid", "worker", "activity_type", "amount_rupees", "status", "month_year", "created_at")
    list_filter = ("activity_type", "status")
    search_fields = ("worker__username", "worker__phone", "description_en", "description_hi")
