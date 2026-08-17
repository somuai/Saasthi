from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import FacilityViewSet, RiskAssessmentViewSet, RiskRuleViewSet

router = DefaultRouter()
router.register("rules", RiskRuleViewSet, basename="risk-rule")
router.register("assessments", RiskAssessmentViewSet, basename="risk-assessment")
router.register("facilities", FacilityViewSet, basename="facility")

urlpatterns = [path("", include(router.urls))]
