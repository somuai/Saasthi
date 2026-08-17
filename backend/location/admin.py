from django.contrib import admin

from location.models import H3Cell, LocationLog


@admin.register(LocationLog)
class LocationLogAdmin(admin.ModelAdmin):
    list_display = ["pk", "worker", "latitude", "longitude", "h3_cell_id", "battery_pct", "recorded_at", "received_at"]
    list_filter = ["is_during_visit", "h3_cell_id"]
    search_fields = ["worker__username", "h3_cell_id"]
    readonly_fields = ["received_at"]
    raw_id_fields = ["worker", "visit"]
    date_hierarchy = "recorded_at"


@admin.register(H3Cell)
class H3CellAdmin(admin.ModelAdmin):
    list_display = ["cell_id", "district", "block", "worker_count", "household_count", "updated_at"]
    list_filter = ["district", "resolution"]
    search_fields = ["cell_id", "district", "block"]
    readonly_fields = ["created_at", "updated_at"]
