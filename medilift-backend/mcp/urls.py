from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import CareInteractionViewSet

router = DefaultRouter()
router.register("care-interactions", CareInteractionViewSet, basename="care-interaction")

urlpatterns = [path("", include(router.urls))]
