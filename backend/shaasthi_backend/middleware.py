import logging
import time
import uuid

from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)


def _user_repr(request):
    user = getattr(request, "user", None)
    if user and user.is_authenticated:
        return str(getattr(user, "pk", "-"))
    return "anon"


class RequestIDMiddleware(MiddlewareMixin):
    def process_request(self, request):
        request.request_id = str(uuid.uuid4())

    def process_response(self, request, response):
        rid = getattr(request, "request_id", None)
        if rid:
            response["X-Request-ID"] = rid
        return response


class RequestLoggingMiddleware(MiddlewareMixin):
    def process_request(self, request):
        request._start_time = time.time()

    def process_response(self, request, response):
        duration = time.time() - getattr(request, "_start_time", time.time())
        rid = getattr(request, "request_id", "-")
        logger.info(
            "request  method=%s path=%s status=%d duration=%.3f request_id=%s user=%s",
            request.method,
            request.path,
            response.status_code,
            duration,
            rid,
            _user_repr(request),
        )
        return response
