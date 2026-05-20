from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework_simplejwt.views import TokenRefreshView

from shaasthi_backend.health_views import health_check

urlpatterns = [
    path("health/", health_check, name="health"),
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
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
    path("api/v1/config/", include("shaasthi_backend.config_urls")),
    path("api/v1/dashboard/", include("analytics.dashboard_urls")),
]
