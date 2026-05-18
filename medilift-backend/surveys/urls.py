from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import SurveyResponseViewSet

router = DefaultRouter()
router.register("responses", SurveyResponseViewSet, basename="survey-response")

urlpatterns = [path("", include(router.urls))]
