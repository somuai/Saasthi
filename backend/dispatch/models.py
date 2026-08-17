from django.conf import settings
from django.db import models


class EmergencyDispatch(models.Model):
    """Tracks an emergency dispatch lifecycle — analogous to an Uber Trip."""

    class Severity(models.TextChoices):
        CRITICAL = "CRITICAL", "Critical"
        HIGH = "HIGH", "High"
        MODERATE = "MODERATE", "Moderate"

    class State(models.TextChoices):
        DETECTED = "DETECTED", "Detected"
        DISPATCHING = "DISPATCHING", "Dispatching"
        ASSIGNED = "ASSIGNED", "Assigned"
        ACKNOWLEDGED = "ACKNOWLEDGED", "Acknowledged"
        EN_ROUTE = "EN_ROUTE", "En Route"
        ON_SITE = "ON_SITE", "On Site"
        RESOLVED = "RESOLVED", "Resolved"
        REFERRED = "REFERRED", "Referred"
        ESCALATED = "ESCALATED", "Escalated"
        SUPERVISOR_NOTIFIED = "SUPERVISOR_NOTIFIED", "Supervisor Notified"
        TIMEOUT = "TIMEOUT", "Timeout"

    class TriggerSource(models.TextChoices):
        RISK_ENGINE = "risk_engine", "Risk Engine"
        ASHA_MANUAL = "asha_manual", "ASHA Manual"
        SYNC_LATE = "sync_late", "Late Sync Detection"
        SUPERVISOR = "supervisor", "Supervisor"

    class Resolution(models.TextChoices):
        RESOLVED_ON_SITE = "resolved_on_site", "Resolved On Site"
        REFERRED = "referred", "Referred to Facility"
        FALSE_ALARM = "false_alarm", "False Alarm"
        TIMEOUT = "timeout", "Timeout"

    household = models.ForeignKey(
        "registry.Household", on_delete=models.CASCADE, related_name="emergency_dispatches", db_index=True
    )
    patient = models.ForeignKey(
        "registry.Patient", on_delete=models.SET_NULL, null=True, blank=True, related_name="emergency_dispatches"
    )
    severity = models.CharField(max_length=20, choices=Severity.choices, db_index=True)
    state = models.CharField(max_length=30, choices=State.choices, default=State.DETECTED, db_index=True)
    triggered_by = models.CharField(max_length=20, choices=TriggerSource.choices)

    assigned_worker = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="dispatch_assignments"
    )

    dispatched_at = models.DateTimeField(null=True, blank=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    arrived_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    resolution = models.CharField(max_length=30, choices=Resolution.choices, null=True, blank=True)

    h3_cell_id = models.CharField(max_length=16, db_index=True, blank=True, default="")
    search_radius_ring = models.PositiveSmallIntegerField(default=1)
    candidates_considered = models.PositiveSmallIntegerField(default=0)

    is_delayed_sync = models.BooleanField(default=False)
    offline_duration_minutes = models.PositiveIntegerField(null=True, blank=True)

    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["state"], name="idx_dispatch_state"),
            models.Index(fields=["assigned_worker", "state"], name="idx_dispatch_worker_state"),
            models.Index(fields=["household", "-created_at"], name="idx_dispatch_household"),
        ]

    def __str__(self):
        return f"Dispatch #{self.pk} [{self.severity}] → {self.household}"


class VisitStateLog(models.Model):
    """Immutable audit log of visit state transitions — analogous to Uber Trip State Machine logs."""

    visit = models.ForeignKey("followups.FollowUp", on_delete=models.CASCADE, related_name="state_logs")
    from_state = models.CharField(max_length=30)
    to_state = models.CharField(max_length=30)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["visit", "timestamp"], name="idx_visit_state_log"),
        ]

    def __str__(self):
        return f"{self.visit_id}: {self.from_state} → {self.to_state}"
