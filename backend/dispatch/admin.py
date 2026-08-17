from django.contrib import admin

from dispatch.models import EmergencyDispatch, VisitStateLog


@admin.register(EmergencyDispatch)
class EmergencyDispatchAdmin(admin.ModelAdmin):
    list_display = [
        "pk",
        "severity",
        "state",
        "household",
        "assigned_worker",
        "triggered_by",
        "is_delayed_sync",
        "created_at",
    ]
    list_filter = ["severity", "state", "triggered_by", "is_delayed_sync"]
    search_fields = ["household__head_name", "household__village"]
    readonly_fields = [
        "created_at",
        "updated_at",
        "dispatched_at",
        "acknowledged_at",
        "arrived_at",
        "resolved_at",
    ]
    raw_id_fields = ["household", "patient", "assigned_worker"]
    date_hierarchy = "created_at"


@admin.register(VisitStateLog)
class VisitStateLogAdmin(admin.ModelAdmin):
    list_display = ["pk", "visit", "from_state", "to_state", "actor", "timestamp"]
    list_filter = ["from_state", "to_state"]
    search_fields = ["visit__pk"]
    readonly_fields = ["timestamp"]
    raw_id_fields = ["visit", "actor"]
    date_hierarchy = "timestamp"
