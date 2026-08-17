"""REST views for location tracking — fallback for non-WebSocket clients."""

import logging
import time

from dispatch.h3_index import (
    find_nearby_workers,
    get_latest_position,
    latlng_to_h3_cell,
    set_worker_status,
    update_ring_buffer,
    update_worker_h3_cell,
)
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


class LocationUpdateSerializer(serializers.Serializer):
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)
    accuracy_m = serializers.FloatField(required=False, allow_null=True)
    altitude_m = serializers.FloatField(required=False, allow_null=True)
    speed_mps = serializers.FloatField(required=False, allow_null=True)
    battery_pct = serializers.IntegerField(required=False, min_value=0, max_value=100, allow_null=True)
    recorded_at = serializers.DateTimeField(required=False)


class NearbyWorkersRequestSerializer(serializers.Serializer):
    latitude = serializers.FloatField(min_value=-90, max_value=90)
    longitude = serializers.FloatField(min_value=-180, max_value=180)
    radius_ring = serializers.IntegerField(required=False, default=1, min_value=1, max_value=5)


class LocationUpdateView(APIView):
    """
    POST /api/v1/location/update/

    REST fallback for GPS location updates (primary path is WebSocket).
    Updates Redis ring buffer + H3 geospatial index.
    """

    permission_classes = [IsAuthenticated]
    throttle_scope = "location_update"

    def post(self, request):
        serializer = LocationUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        worker_id = request.user.pk
        lat = data["latitude"]
        lng = data["longitude"]
        now = time.time()

        # 1. Update ring buffer
        location_data = {
            "lat": lat,
            "lng": lng,
            "accuracy": data.get("accuracy_m"),
            "battery_pct": data.get("battery_pct"),
            "timestamp": now,
            "h3_cell_id": latlng_to_h3_cell(lat, lng) or "",
        }
        update_ring_buffer(worker_id, location_data)

        # 2. Update H3 index
        cell_id = update_worker_h3_cell(worker_id, lat, lng)

        # 3. Set worker as active
        set_worker_status(worker_id, "active")

        # 4. Publish to Redis stream for cold-path persistence
        try:
            from dispatch.h3_index import get_redis_client

            r = get_redis_client()
            if r:
                r.xadd(
                    "location_updates",
                    {
                        "worker_id": str(worker_id),
                        "lat": str(lat),
                        "lng": str(lng),
                        "accuracy": str(data.get("accuracy_m", "")),
                        "battery_pct": str(data.get("battery_pct", "")),
                        "h3_cell_id": cell_id or "",
                        "recorded_at": (data.get("recorded_at") or timezone.now()).isoformat(),
                        "is_during_visit": "false",
                    },
                    maxlen=100000,  # Cap stream size
                )
        except Exception:
            logger.exception("Failed to publish location to Redis stream")

        return Response(
            {"status": "ok", "h3_cell": cell_id},
            status=status.HTTP_200_OK,
        )


class NearbyWorkersView(APIView):
    """
    GET /api/v1/location/nearby-workers/?latitude=...&longitude=...&radius_ring=1

    Returns nearby active ASHA workers. Restricted to supervisors/admins.
    Used by the supervisor dashboard for the live map.
    """

    permission_classes = [IsAuthenticated]
    throttle_scope = "analytics"

    def get(self, request):
        # Check user has supervisor-level access
        user_role = getattr(request.user, "role", "")
        if user_role not in ("admin", "state_admin", "district_officer", "block_manager", "supervisor"):
            return Response(
                {"detail": "Supervisor access required."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = NearbyWorkersRequestSerializer(data=request.query_params)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        worker_ids = find_nearby_workers(
            data["latitude"],
            data["longitude"],
            radius_ring=data["radius_ring"],
        )

        # Fetch latest positions for each worker
        workers = []
        for wid_str in worker_ids:
            try:
                wid = int(wid_str)
            except (ValueError, TypeError):
                continue

            pos = get_latest_position(wid)
            if pos:
                workers.append({
                    "worker_id": wid,
                    "latitude": pos.get("lat"),
                    "longitude": pos.get("lng"),
                    "battery_pct": pos.get("battery_pct"),
                    "last_update": pos.get("timestamp"),
                    "h3_cell": pos.get("h3_cell_id"),
                })

        return Response({"workers": workers, "count": len(workers)})
