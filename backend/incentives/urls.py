from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import IncentiveLedgerEntryViewSet, IncentiveRateViewSet

router = DefaultRouter()
router.register("ledger", IncentiveLedgerEntryViewSet, basename="incentive-ledger")
router.register("rates", IncentiveRateViewSet, basename="incentive-rate")

urlpatterns = [path("", include(router.urls))]
