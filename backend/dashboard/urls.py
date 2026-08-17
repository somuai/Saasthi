from django.urls import include, path, re_path

from .api.urls import urlpatterns as api_urls
from .views import DashboardSPAView

urlpatterns = [
    path("api/", include((api_urls, "dashboard-api"))),
    re_path(r"^.*$", DashboardSPAView.as_view(), name="dashboard-spa"),
]
