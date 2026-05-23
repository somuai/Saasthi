import logging

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    request = context.get("request")
    rid = getattr(request, "request_id", None) if request else None

    if isinstance(exc, Http404):
        return Response(
            {"detail": "Not found.", "request_id": rid},
            status=status.HTTP_404_NOT_FOUND,
        )

    if isinstance(exc, DjangoPermissionDenied):
        return Response(
            {"detail": "Permission denied.", "request_id": rid},
            status=status.HTTP_403_FORBIDDEN,
        )

    response = exception_handler(exc, context)

    if response is not None:
        if isinstance(response.data, dict):
            response.data["request_id"] = rid
        return response

    logger.exception(
        "Unhandled exception: %s | %s",
        rid,
        exc,
        extra={"request_id": rid, "path": request.path if request else None},
    )

    return Response(
        {
            "detail": "Internal server error.",
            "request_id": rid,
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
    )
