from django.contrib import admin

from .models import IncentiveLedgerEntry


@admin.register(IncentiveLedgerEntry)
class IncentiveLedgerEntryAdmin(admin.ModelAdmin):
    list_display = ("local_uuid", "worker", "category", "amount", "created_at")
    list_filter = ("category",)
    search_fields = ("worker__username", "worker__phone", "description")
