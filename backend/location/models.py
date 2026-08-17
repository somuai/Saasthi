from django.conf import settings
from django.db import models


class LocationLog(models.Model):
    """
    Cold-path storage for GPS pings — analogous to Uber writing all driver
    location updates to Cassandra for analytics.

    Hot-path (real-time) data lives in Redis ring buffers (dispatch.h3_index).
    """

    worker = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="location_logs", db_index=True
    )
    latitude = models.FloatField()
    longitude = models.FloatField()
    accuracy_m = models.FloatField(null=True, blank=True)
    altitude_m = models.FloatField(null=True, blank=True)
    speed_mps = models.FloatField(null=True, blank=True)
    battery_pct = models.PositiveSmallIntegerField(null=True, blank=True)
    h3_cell_id = models.CharField(max_length=16, db_index=True, blank=True, default="")

    # When the GPS was captured on device vs. when server received it
    recorded_at = models.DateTimeField(db_index=True)
    received_at = models.DateTimeField(auto_now_add=True)

    is_during_visit = models.BooleanField(default=False)
    visit = models.ForeignKey(
        "followups.FollowUp", on_delete=models.SET_NULL, null=True, blank=True, related_name="location_logs"
    )

    class Meta:
        ordering = ["-recorded_at"]
        indexes = [
            models.Index(fields=["worker", "-recorded_at"], name="idx_loc_worker_time"),
            models.Index(fields=["h3_cell_id", "-recorded_at"], name="idx_loc_h3_time"),
        ]

    def __str__(self):
        return f"Location {self.worker_id} @ {self.recorded_at}"


class H3Cell(models.Model):
    """
    Pre-computed metadata for H3 hexagonal cells covering the service area.

    Denormalized worker/household counts for the supervisor dashboard's
    coverage heatmap (Uber's "God View" equivalent).
    """

    cell_id = models.CharField(max_length=16, primary_key=True)
    resolution = models.PositiveSmallIntegerField(default=8)
    center_lat = models.FloatField()
    center_lng = models.FloatField()

    district = models.CharField(max_length=100, db_index=True, blank=True, default="")
    block = models.CharField(max_length=100, db_index=True, blank=True, default="")

    # Denormalized counters for dashboard (refreshed periodically)
    worker_count = models.PositiveIntegerField(default=0)
    household_count = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["cell_id"]
        verbose_name = "H3 Cell"
        verbose_name_plural = "H3 Cells"

    def __str__(self):
        return f"H3 Cell {self.cell_id} ({self.district}/{self.block})"
