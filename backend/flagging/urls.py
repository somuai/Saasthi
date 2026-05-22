from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import FlagViewSet

router = DefaultRouter()
router.register("", FlagViewSet, basename="flag")

urlpatterns = [path("", include(router.urls))]
