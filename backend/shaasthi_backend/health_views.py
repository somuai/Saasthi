from django.db import connection
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET


@require_GET
def health_check(request):
    payload = {
        "status": "healthy",
        "timestamp": timezone.now().isoformat(),
        "db": "unknown",
        "queue_depth": None,
    }
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        payload["db"] = "connected"
    except Exception as exc:
        return JsonResponse(
            {"status": "unhealthy", "db": "disconnected", "error": str(exc)},
            status=503,
        )

    try:
        from django.conf import settings

        import redis

        client = redis.from_url(settings.REDIS_URL)
        client.ping()
        payload["redis"] = "connected"
        try:
            depth = client.llen("risk_assessment")
            payload["queue_depth"] = depth
        except Exception:
            payload["queue_depth"] = None
    except Exception:
        payload["redis"] = "unavailable"

    return JsonResponse(payload)
