import logging
import threading
import time
import uuid

from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from django.utils.deprecation import MiddlewareMixin
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import UntypedToken

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


_thread_locals = threading.local()


def get_current_request():
    return getattr(_thread_locals, "request", None)


class ThreadLocalMiddleware(MiddlewareMixin):
    def process_request(self, request):
        _thread_locals.request = request

    def process_response(self, request, response):
        if hasattr(_thread_locals, "request"):
            del _thread_locals.request
        return response


@database_sync_to_async
def get_user(token):
    try:
        UntypedToken(token)
    except (InvalidToken, TokenError):
        return AnonymousUser()
    from rest_framework_simplejwt.authentication import JWTAuthentication

    jwt_auth = JWTAuthentication()
    try:
        validated_token = jwt_auth.get_validated_token(token)
        user = jwt_auth.get_user(validated_token)
        return user
    except Exception:
        return AnonymousUser()


class TokenAuthMiddleware:
    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode("utf-8")
        token = None
        for param in query_string.split("&"):
            if param.startswith("token="):
                token = param.split("=")[1]
                break

        if token:
            scope["user"] = await get_user(token)
        else:
            scope["user"] = AnonymousUser()

        return await self.inner(scope, receive, send)
