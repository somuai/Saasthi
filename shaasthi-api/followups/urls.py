from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import FollowUpViewSet, VisitRecordViewSet

router = DefaultRouter()
router.register("followups", FollowUpViewSet, basename="followup")
router.register("visits", VisitRecordViewSet, basename="visit")

urlpatterns = [path("", include(router.urls))]
