"""Celery tasks for location tracking — runs on the 'location' queue."""

import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(name="location.persist_location_batch")
def persist_location_batch():
    """
    Drain GPS pings from Redis and batch-INSERT into PostgreSQL.

    Uber equivalent: Async write from Ring Buffer to Cassandra/cold storage.
    Runs every 60 seconds via Celery Beat.
    """
    try:
        import redis as redis_lib
        from django.conf import settings

        from location.models import LocationLog

        redis_url = getattr(settings, "REDIS_URL", "redis://localhost:6379/0")
        r = redis_lib.from_url(redis_url, decode_responses=True)

        stream_key = "location_updates"

        # Read up to 1000 entries from the stream
        entries = r.xrange(stream_key, count=1000)
        if not entries:
            return 0

        records = []
        entry_ids = []
        for entry_id, data in entries:
            entry_ids.append(entry_id)
            try:
                records.append(
                    LocationLog(
                        worker_id=int(data.get("worker_id", 0)),
                        latitude=float(data.get("lat", 0)),
                        longitude=float(data.get("lng", 0)),
                        accuracy_m=float(data["accuracy"]) if data.get("accuracy") else None,
                        altitude_m=float(data["altitude"]) if data.get("altitude") else None,
                        speed_mps=float(data["speed"]) if data.get("speed") else None,
                        battery_pct=int(data["battery_pct"]) if data.get("battery_pct") else None,
                        h3_cell_id=data.get("h3_cell_id", ""),
                        recorded_at=data.get("recorded_at", timezone.now().isoformat()),
                        is_during_visit=data.get("is_during_visit", "false").lower() == "true",
                        visit_id=int(data["visit_id"]) if data.get("visit_id") else None,
                    )
                )
            except (ValueError, TypeError):
                logger.exception("Failed to parse location entry: %s", entry_id)

        if records:
            LocationLog.objects.bulk_create(records, ignore_conflicts=True)

        # Remove processed entries from stream
        if entry_ids:
            r.xdel(stream_key, *entry_ids)

        logger.info("Persisted %d location records from Redis stream", len(records))
        return len(records)

    except Exception:
        logger.exception("Failed to persist location batch")
        return 0


@shared_task(name="location.update_h3_cell_stats")
def update_h3_cell_stats():
    """
    Update denormalized worker/household counts on H3Cell records.

    Used by the supervisor dashboard's coverage heatmap.
    Runs every 5 minutes via Celery Beat.
    """
    try:
        import redis as redis_lib
        from django.conf import settings

        from location.models import H3Cell

        redis_url = getattr(settings, "REDIS_URL", "redis://localhost:6379/0")
        r = redis_lib.from_url(redis_url, decode_responses=True)

        import time

        cutoff = time.time() - 300  # Active in last 5 minutes

        cells = H3Cell.objects.all()
        updated = 0
        for cell in cells:
            key = f"h3:res8:{cell.cell_id}"
            try:
                active_count = r.zcount(key, cutoff, "+inf")
            except Exception:
                active_count = 0

            if cell.worker_count != active_count:
                cell.worker_count = active_count
                cell.save(update_fields=["worker_count", "updated_at"])
                updated += 1

        logger.info("Updated H3 cell stats: %d cells refreshed", updated)
        return updated

    except Exception:
        logger.exception("Failed to update H3 cell stats")
        return 0
