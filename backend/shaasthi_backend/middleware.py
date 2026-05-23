import logging
import time
import uuid

from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)


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
            getattr(request.user, "pk", "-") if request.user.is_authenticated else "anon",
        )
        return response
