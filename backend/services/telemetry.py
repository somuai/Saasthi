import logging
import os

import httpx
from celery import shared_task

logger = logging.getLogger(__name__)

POSTHOG_API_KEY = os.getenv("POSTHOG_API_KEY")
POSTHOG_HOST = os.getenv("POSTHOG_HOST", "https://us.i.posthog.com").rstrip("/")


@shared_task(name="telemetry.send_posthog_event", max_retries=3, default_retry_delay=10)
def send_posthog_event_task(distinct_id: str, event_name: str, properties: dict = None, event_uuid: str = None):
    """Celery background task to dispatch event tracking payload to PostHog."""
    if not POSTHOG_API_KEY:
        logger.debug("PostHog API key missing; skipping event capture.")
        return

    payload = {
        "api_key": POSTHOG_API_KEY,
        "event": event_name,
        "properties": {
            "distinct_id": distinct_id,
            **(properties or {}),
            "$lib": "saasthi-python-telemetry",
            "$lib_version": "1.0.0",
        },
    }
    if event_uuid:
        payload["uuid"] = event_uuid

    try:
        response = httpx.post(
            f"{POSTHOG_HOST}/capture/", json=payload, headers={"Content-Type": "application/json"}, timeout=5.0
        )
        response.raise_for_status()
        logger.debug("telemetry_event_sent event=%s", event_name)
    except httpx.HTTPStatusError as exc:
        logger.warning("telemetry_error status=%d response=%s", exc.response.status_code, exc.response.text)
        raise send_posthog_event_task.retry(exc=exc)
    except Exception as exc:
        logger.exception("telemetry_network_failure")
        raise send_posthog_event_task.retry(exc=exc)


def track_event(distinct_id: str, event_name: str, properties: dict = None):
    """Enqueues a telemetry event tracking payload to the Celery queue."""
    if not POSTHOG_API_KEY:
        return
    import uuid

    event_uuid = str(uuid.uuid4())
    try:
        send_posthog_event_task.delay(distinct_id, event_name, properties, event_uuid=event_uuid)
    except Exception:
        # Avoid crashing the application flow if Redis/Celery queue is down
        logger.exception("failed_to_enqueue_telemetry_event")
