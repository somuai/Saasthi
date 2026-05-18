from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AnalyticsSnapshotViewSet

router = DefaultRouter()
router.register("snapshots", AnalyticsSnapshotViewSet, basename="analytics-snapshot")

urlpatterns = [path("", include(router.urls))]
