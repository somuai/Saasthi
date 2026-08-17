import os

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "shaasthi_backend.settings")

django_asgi_app = get_asgi_application()

import location.routing  # noqa: E402

from shaasthi_backend.middleware import TokenAuthMiddleware  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": TokenAuthMiddleware(URLRouter(location.routing.websocket_urlpatterns)),
    }
)
