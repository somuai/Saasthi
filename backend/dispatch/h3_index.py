"""
H3 Geospatial Index — Redis-backed spatial registry for ASHA worker positions.

Uber equivalent: Location Service + Geospatial Index (H3 hexagonal grid).

Redis key schema:
    h3:res8:{cell_id}           → SortedSet (members=worker IDs, scores=timestamps)
    worker:{id}:locations       → List (ring buffer, capped at 5 entries)
    worker:{id}:status          → String ("active"|"idle"|"emergency"|"offline")
"""

import json
import logging
import time

from django.conf import settings

logger = logging.getLogger(__name__)

try:
    import h3
except ImportError:
    h3 = None
    logger.warning("h3 library not installed — geospatial indexing will be unavailable. Run: pip install 'h3>=4.1,<5'")

try:
    import redis as redis_lib
except ImportError:
    redis_lib = None
    logger.warning("redis library not available for h3_index")

H3_RESOLUTION = 8  # ~860m edge-to-edge, covers a typical village
RING_BUFFER_SIZE = 5  # Keep last 5 GPS pings per worker
RING_BUFFER_TTL = 3600  # 1 hour TTL — auto-expire if worker goes offline
H3_KEY_PREFIX = "h3:res8"
WORKER_KEY_PREFIX = "worker"

_redis_client = None


def get_redis_client():
    """Lazy-initialize a Redis client from settings.REDIS_URL."""
    global _redis_client
    if _redis_client is None:
        if redis_lib is None:
            logger.error("redis library not installed")
            return None
        redis_url = getattr(settings, "REDIS_URL", "redis://localhost:6379/0")
        _redis_client = redis_lib.from_url(redis_url, decode_responses=True)
    return _redis_client


def latlng_to_h3_cell(lat: float, lng: float) -> str | None:
    """Convert lat/lng to H3 cell ID at the configured resolution."""
    if h3 is None:
        return None
    try:
        return h3.latlng_to_cell(lat, lng, H3_RESOLUTION)
    except Exception:
        logger.exception("Failed to compute H3 cell for lat=%s, lng=%s", lat, lng)
        return None


def update_worker_h3_cell(worker_id: int, lat: float, lng: float, previous_cell_id: str | None = None) -> str | None:
    """
    Update a worker's position in the H3 geospatial index.

    1. Compute current H3 cell from coordinates
    2. If cell changed, remove from old cell's sorted set
    3. Add to new cell's sorted set with current timestamp as score
    """
    r = get_redis_client()
    if r is None or h3 is None:
        return None

    cell_id = latlng_to_h3_cell(lat, lng)
    if cell_id is None:
        return None

    now = time.time()
    pipe = r.pipeline()

    # Remove from previous cell if it changed
    if previous_cell_id and previous_cell_id != cell_id:
        pipe.zrem(f"{H3_KEY_PREFIX}:{previous_cell_id}", str(worker_id))

    # Add/update in current cell
    pipe.zadd(f"{H3_KEY_PREFIX}:{cell_id}", {str(worker_id): now})

    try:
        pipe.execute()
    except Exception:
        logger.exception("Failed to update H3 index for worker=%s", worker_id)
        return None

    return cell_id


def remove_worker_from_h3_cell(worker_id: int, cell_id: str) -> None:
    """Remove a worker from an H3 cell's sorted set."""
    r = get_redis_client()
    if r is None:
        return
    try:
        r.zrem(f"{H3_KEY_PREFIX}:{cell_id}", str(worker_id))
    except Exception:
        logger.exception("Failed to remove worker=%s from H3 cell=%s", worker_id, cell_id)


def find_nearby_workers(lat: float, lng: float, radius_ring: int = 1, max_age_seconds: int = 300) -> list[str]:
    """
    Uber-style H3 proximity search.

    radius_ring=1 → current cell + 6 neighbors (~5km at res 8)
    radius_ring=2 → current cell + 18 neighbors (~10km)
    radius_ring=3 → current cell + 36 neighbors (~15km)

    Returns list of worker IDs active within max_age_seconds.
    """
    r = get_redis_client()
    if r is None or h3 is None:
        return []

    center_cell = latlng_to_h3_cell(lat, lng)
    if center_cell is None:
        return []

    try:
        search_cells = h3.grid_disk(center_cell, radius_ring)
    except Exception:
        logger.exception("Failed to compute grid_disk for cell=%s, ring=%s", center_cell, radius_ring)
        return []

    cutoff = time.time() - max_age_seconds
    pipe = r.pipeline()

    for cell_id in search_cells:
        pipe.zrangebyscore(f"{H3_KEY_PREFIX}:{cell_id}", min=cutoff, max="+inf")

    try:
        results = pipe.execute()
    except Exception:
        logger.exception("Failed to query H3 cells for nearby workers")
        return []

    return [worker_id for cell_workers in results for worker_id in cell_workers]


def update_ring_buffer(worker_id: int, location_data: dict) -> None:
    """
    Push a GPS ping into the worker's ring buffer (Redis List, capped at RING_BUFFER_SIZE).

    Uber equivalent: Ring Buffer for driver location history.
    """
    r = get_redis_client()
    if r is None:
        return

    key = f"{WORKER_KEY_PREFIX}:{worker_id}:locations"
    try:
        pipe = r.pipeline()
        pipe.lpush(key, json.dumps(location_data))
        pipe.ltrim(key, 0, RING_BUFFER_SIZE - 1)
        pipe.expire(key, RING_BUFFER_TTL)
        pipe.execute()
    except Exception:
        logger.exception("Failed to update ring buffer for worker=%s", worker_id)


def get_latest_position(worker_id: int) -> dict | None:
    """Get the most recent GPS position from a worker's ring buffer."""
    r = get_redis_client()
    if r is None:
        return None

    key = f"{WORKER_KEY_PREFIX}:{worker_id}:locations"
    try:
        raw = r.lindex(key, 0)
        if raw:
            return json.loads(raw)
    except Exception:
        logger.exception("Failed to read ring buffer for worker=%s", worker_id)

    return None


def get_position_history(worker_id: int) -> list[dict]:
    """Get the full ring buffer (last N pings) for a worker."""
    r = get_redis_client()
    if r is None:
        return []

    key = f"{WORKER_KEY_PREFIX}:{worker_id}:locations"
    try:
        raw_list = r.lrange(key, 0, RING_BUFFER_SIZE - 1)
        return [json.loads(item) for item in raw_list]
    except Exception:
        logger.exception("Failed to read position history for worker=%s", worker_id)

    return []


def set_worker_status(worker_id: int, status: str) -> None:
    """Set a worker's current status (active, idle, emergency, offline)."""
    r = get_redis_client()
    if r is None:
        return
    try:
        r.setex(f"{WORKER_KEY_PREFIX}:{worker_id}:status", RING_BUFFER_TTL, status)
    except Exception:
        logger.exception("Failed to set status for worker=%s", worker_id)


def get_worker_status(worker_id: int) -> str:
    """Get a worker's current status. Returns 'offline' if no status is set."""
    r = get_redis_client()
    if r is None:
        return "offline"
    try:
        status = r.get(f"{WORKER_KEY_PREFIX}:{worker_id}:status")
        return status or "offline"
    except Exception:
        logger.exception("Failed to get status for worker=%s", worker_id)
        return "offline"
