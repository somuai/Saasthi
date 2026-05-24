import logging

from celery import current_app
from django.conf import settings
from django.db import connections
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

logger = logging.getLogger(__name__)

UNHEALTHY = "unhealthy"
DEGRADED = "degraded"
HEALTHY = "healthy"


@extend_schema(responses={200: {"type": "object", "properties": {"status": {"type": "string"}}}})
@api_view(["GET"])
@permission_classes([AllowAny])
def liveness(request):
    return Response({"status": "alive"})


@extend_schema(responses={200: {"type": "object"}, 503: {"type": "object"}})
@api_view(["GET"])
@permission_classes([AllowAny])
def readiness(request):
    checks = {}
    overall = HEALTHY

    # Database
    try:
        connections["default"].cursor().execute("SELECT 1")
        checks["database"] = HEALTHY
    except Exception as exc:
        checks["database"] = UNHEALTHY
        checks["database_detail"] = str(exc)
        overall = UNHEALTHY

    # Redis (cache or broker)
    redis_ok = False
    for label, url in [
        ("redis_cache", settings.REDIS_URL),
        ("redis_broker", settings.CELERY_BROKER_URL),
    ]:
        try:
            import redis

            client = redis.from_url(url)
            client.ping()
            client.close()
            checks[label] = HEALTHY
            redis_ok = True
        except Exception as exc:
            checks[label] = UNHEALTHY
            checks[f"{label}_detail"] = str(exc)

    if not redis_ok:
        overall = UNHEALTHY

    return Response(
        {"status": overall, "checks": checks, "version": getattr(settings, "APP_VERSION", "0.1.0")},
        status=200 if overall != UNHEALTHY else 503,
    )


@extend_schema(responses={200: {"type": "object"}})
@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    data = {"status": "ok", "version": getattr(settings, "APP_VERSION", "0.1.0")}
    try:
        connections["default"].cursor().execute("SELECT 1")
        data["database"] = "ok"
    except Exception as exc:
        data["database"] = "error"
        data["database_detail"] = str(exc)
        data["status"] = "degraded"

    try:
        insp = current_app.control.inspect()
        ping = insp.ping()
        if ping:
            data["celery"] = "ok"
            data["celery_workers"] = list(ping.keys())
        else:
            data["celery"] = "no_workers"
            data["status"] = "degraded"
    except Exception as exc:
        data["celery"] = "error"
        data["celery_detail"] = str(exc)
        data["status"] = "degraded"

    return Response(data)
