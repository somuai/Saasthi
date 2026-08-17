import os

from django.conf import settings
from django.contrib import admin
from django.urls import include, path
from rest_framework_simplejwt.views import TokenRefreshView

from shaasthi_backend.health_views import health_check, liveness, privacy_policy_view, readiness

ADMIN_SLUG = os.getenv("ADMIN_URL_SLUG", "admin")

urlpatterns = [
    path("privacy/", privacy_policy_view, name="privacy_policy"),
    path("health/", health_check, name="health"),
    path("livez/", liveness, name="liveness"),
    path("readyz/", readiness, name="readiness"),
    path(f"{ADMIN_SLUG}/", admin.site.urls),
    path("api/v1/auth/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/v1/auth/", include("accounts.urls")),
    path("api/v1/registry/", include("registry.urls")),
    path("api/v1/surveys/", include("surveys.urls")),
    path("api/v1/mcp/", include("mcp.urls")),
    path("api/v1/sync/", include("sync.urls")),
    path("api/v1/risk/", include("risk_engine.urls")),
    path("api/v1/flags/", include("flagging.urls")),
    path("api/v1/referrals/", include("referrals.urls")),
    path("api/v1/incentives/", include("incentives.urls")),
    path("api/v1/analytics/", include("analytics.urls")),
    path("api/v1/notifications/", include("notifications.urls")),
    path("api/v1/", include("followups.urls")),
    path("api/v1/config/", include("shaasthi_backend.config_urls")),
    path("api/v1/dashboard/admin/", include("dashboard.api.urls")),
    path("api/v1/dashboard/", include("analytics.dashboard_urls")),
    path("api/anm/", include("api.routers.anm")),
    path("api/v1/dispatch/", include("dispatch.urls")),
    path("api/v1/location/", include("location.urls")),
    path("dashboard/", include("dashboard.urls")),
    path("", include("django_prometheus.urls")),
]

if settings.DEBUG:
    from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

    urlpatterns += [
        path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
        path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    ]
