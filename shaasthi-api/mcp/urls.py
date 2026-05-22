from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ANCVisitViewSet,
    CareInteractionViewSet,
    DeliveryRecordViewSet,
    DevelopmentMilestoneCheckViewSet,
    GrowthRecordViewSet,
    IFAComplianceViewSet,
    ImmunizationRecordViewSet,
    MCPSurveySessionViewSet,
    PNCVisitViewSet,
)

router = DefaultRouter()
router.register("care-interactions", CareInteractionViewSet, basename="care-interaction")
router.register("anc-visits", ANCVisitViewSet, basename="anc-visit")
router.register("deliveries", DeliveryRecordViewSet, basename="delivery")
router.register("pnc-visits", PNCVisitViewSet, basename="pnc-visit")
router.register("growth-records", GrowthRecordViewSet, basename="growth-record")
router.register("milestone-checks", DevelopmentMilestoneCheckViewSet, basename="milestone-check")
router.register("immunizations", ImmunizationRecordViewSet, basename="immunization")
router.register("ifa-compliance", IFAComplianceViewSet, basename="ifa-compliance")
router.register("sessions", MCPSurveySessionViewSet, basename="mcp-session")

urlpatterns = [path("", include(router.urls))]
