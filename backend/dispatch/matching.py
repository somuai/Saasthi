"""
Matching Engine — Uber-style dispatch with H3 proximity search and scoring.

Uber equivalent: Dispatch/Matching Service that finds the nearest available driver.
For Saasthi: finds the nearest available ASHA worker for maternal emergencies.
"""

import logging
import time
from dataclasses import dataclass

from django.utils import timezone
from followups.services.gps_service import haversine_distance_m

from dispatch.h3_index import (
    find_nearby_workers,
    get_latest_position,
    get_redis_client,
    get_worker_status,
    latlng_to_h3_cell,
)

logger = logging.getLogger(__name__)

# Walking speed on rural paths: ~4 km/h = ~67 m/min
WALKING_SPEED_M_PER_MIN = 67.0

# Dispatch lock TTL: 3 minutes for worker to acknowledge
DISPATCH_LOCK_TTL = 180


@dataclass
class MatchCandidate:
    worker_id: int
    distance_m: float
    eta_minutes: float
    current_workload: int
    risk_training_level: str  # "basic" | "advanced" | "emergency"
    battery_pct: int
    last_ping_age_s: float


def score_candidate(candidate: MatchCandidate, emergency_severity: str) -> float:
    """
    Score a candidate for emergency dispatch.

    Uber scores: distance, ETA, rating, vehicle type.
    Saasthi scores: distance, ETA, training level, workload, battery, freshness.
    """
    # Base: Inverse distance (closer = better)
    score = 1000.0 / max(candidate.distance_m, 100)

    # Training bonus (emergency-trained workers get priority for CRITICAL)
    if emergency_severity == "CRITICAL" and candidate.risk_training_level == "emergency":
        score *= 2.0
    elif candidate.risk_training_level == "advanced":
        score *= 1.5

    # Workload penalty (avoid overloading one worker)
    score *= max(0.3, 1.0 - (candidate.current_workload * 0.1))

    # Battery gate (don't dispatch someone at 5% battery)
    if candidate.battery_pct < 15:
        score *= 0.1  # Nearly disqualify
    elif candidate.battery_pct < 30:
        score *= 0.5

    # Freshness bonus (recent GPS = more reliable position)
    if candidate.last_ping_age_s < 60:
        score *= 1.2
    elif candidate.last_ping_age_s > 300:
        score *= 0.5  # 5+ min old position = unreliable

    return score


def _get_worker_workload(worker_id: int) -> int:
    """Get the number of active dispatches assigned to a worker today."""
    try:
        from dispatch.models import EmergencyDispatch

        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        return EmergencyDispatch.objects.filter(
            assigned_worker_id=worker_id,
            created_at__gte=today_start,
        ).exclude(
            state__in=["RESOLVED", "REFERRED", "TIMEOUT"]
        ).count()
    except Exception:
        logger.exception("Failed to get workload for worker=%s", worker_id)
        return 0


def _get_training_level(worker_id: int) -> str:
    """Get the risk training level of a worker. Falls back to 'basic'."""
    try:
        from django.contrib.auth import get_user_model

        user_model = get_user_model()
        user = user_model.objects.filter(pk=worker_id).first()
        if user and hasattr(user, "metadata") and isinstance(user.metadata, dict):
            return user.metadata.get("risk_training_level", "basic")
    except Exception:
        logger.exception("Failed to get training level for worker=%s", worker_id)
    return "basic"


def dispatch_emergency(
    patient_lat: float,
    patient_lng: float,
    severity: str,
    household_id: int,
    triggered_by: str = "risk_engine",
    is_delayed: bool = False,
    offline_duration_minutes: int = 0,
):
    """
    Main dispatch loop — Uber's matching algorithm adapted for maternal emergencies.

    1. H3 proximity search with ring expansion (5km → 10km → 15km)
    2. Score and rank candidates
    3. Distributed lock to prevent double-dispatch
    4. Create EmergencyDispatch record
    5. Escalate to supervisor if no workers available
    """
    from dispatch.models import EmergencyDispatch

    r = get_redis_client()
    h3_cell = latlng_to_h3_cell(patient_lat, patient_lng) or ""

    # Create the dispatch record
    dispatch_record = EmergencyDispatch.objects.create(
        household_id=household_id,
        severity=severity,
        state=EmergencyDispatch.State.DISPATCHING,
        triggered_by=triggered_by,
        h3_cell_id=h3_cell,
        is_delayed_sync=is_delayed,
        offline_duration_minutes=offline_duration_minutes if is_delayed else None,
    )

    logger.info(
        "Dispatch #%s: searching for workers near household=%s (severity=%s, cell=%s)",
        dispatch_record.pk,
        household_id,
        severity,
        h3_cell,
    )

    # Ring expansion search (Uber pattern)
    for ring in range(1, 4):  # 5km → 10km → 15km
        worker_ids = find_nearby_workers(patient_lat, patient_lng, radius_ring=ring)

        if not worker_ids:
            logger.info("Dispatch #%s: no workers in ring=%s, expanding", dispatch_record.pk, ring)
            continue

        # Build candidate list
        candidates = []
        for wid_str in worker_ids:
            try:
                wid = int(wid_str)
            except (ValueError, TypeError):
                continue

            # Skip workers already on emergency
            if get_worker_status(wid) == "emergency":
                continue

            latest = get_latest_position(wid)
            if not latest:
                continue

            distance = haversine_distance_m(
                patient_lat, patient_lng,
                float(latest.get("lat", 0)), float(latest.get("lng", 0)),
            )
            eta = distance / WALKING_SPEED_M_PER_MIN if WALKING_SPEED_M_PER_MIN > 0 else 999

            candidates.append(MatchCandidate(
                worker_id=wid,
                distance_m=distance,
                eta_minutes=eta,
                current_workload=_get_worker_workload(wid),
                risk_training_level=_get_training_level(wid),
                battery_pct=int(latest.get("battery_pct", 50)),
                last_ping_age_s=time.time() - float(latest.get("timestamp", 0)),
            ))

        if not candidates:
            logger.info("Dispatch #%s: no valid candidates in ring=%s", dispatch_record.pk, ring)
            continue

        # Score and rank
        candidates.sort(key=lambda c: score_candidate(c, severity), reverse=True)

        dispatch_record.candidates_considered = len(candidates)
        dispatch_record.search_radius_ring = ring

        # Distributed lock — try top 3 candidates (Uber double-dispatch prevention)
        if r is not None:
            for candidate in candidates[:3]:
                lock_key = f"dispatch_lock:worker:{candidate.worker_id}"
                locked = r.set(lock_key, str(household_id), nx=True, ex=DISPATCH_LOCK_TTL)
                if locked:
                    # Successful lock — assign this worker
                    dispatch_record.assigned_worker_id = candidate.worker_id
                    dispatch_record.state = EmergencyDispatch.State.ASSIGNED
                    dispatch_record.dispatched_at = timezone.now()
                    dispatch_record.metadata = {
                        "distance_m": round(candidate.distance_m, 1),
                        "eta_minutes": round(candidate.eta_minutes, 1),
                        "score": round(score_candidate(candidate, severity), 2),
                        "ring": ring,
                    }
                    dispatch_record.save()

                    # Send push notification
                    _send_dispatch_notification(candidate.worker_id, dispatch_record)

                    logger.info(
                        "Dispatch #%s: assigned worker=%s (distance=%.0fm, ETA=%.1fmin, ring=%s)",
                        dispatch_record.pk,
                        candidate.worker_id,
                        candidate.distance_m,
                        candidate.eta_minutes,
                        ring,
                    )
                    return dispatch_record
        else:
            # No Redis — fallback: assign first candidate without locking
            candidate = candidates[0]
            dispatch_record.assigned_worker_id = candidate.worker_id
            dispatch_record.state = EmergencyDispatch.State.ASSIGNED
            dispatch_record.dispatched_at = timezone.now()
            dispatch_record.save()
            _send_dispatch_notification(candidate.worker_id, dispatch_record)
            return dispatch_record

        # All candidates in this ring were locked — expand
        logger.info("Dispatch #%s: all candidates locked in ring=%s, expanding", dispatch_record.pk, ring)

    # No workers available — escalate
    dispatch_record.state = EmergencyDispatch.State.ESCALATED
    dispatch_record.save()
    logger.warning("Dispatch #%s: no workers available, escalating to supervisor", dispatch_record.pk)
    return dispatch_record


def _send_dispatch_notification(worker_id: int, dispatch_record) -> None:
    """Send FCM push notification to the assigned ASHA worker."""
    try:
        from notifications.models import Notification

        Notification.objects.create(
            recipient_id=worker_id,
            channel="in_app",
            title="🚨 Emergency Dispatch",
            body=f"Urgent: {dispatch_record.get_severity_display()} risk patient needs immediate attention.",
            payload={
                "type": "emergency_dispatch",
                "dispatch_id": dispatch_record.pk,
                "household_id": dispatch_record.household_id,
                "severity": dispatch_record.severity,
            },
        )
    except Exception:
        logger.exception("Failed to send dispatch notification to worker=%s", worker_id)
