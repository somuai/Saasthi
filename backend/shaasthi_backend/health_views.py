from django.conf import settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    data = {"status": "ok", "version": getattr(settings, "APP_VERSION", "0.1.0")}
    try:
        from django.db import connections
        connections["default"].cursor().execute("SELECT 1")
        data["database"] = "ok"
    except Exception as exc:
        data["database"] = "error"
        data["database_detail"] = str(exc)
        data["status"] = "degraded"

    try:
        from celery import current_app
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
