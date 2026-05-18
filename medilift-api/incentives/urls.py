from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import IncentiveLedgerEntryViewSet

router = DefaultRouter()
router.register("ledger", IncentiveLedgerEntryViewSet, basename="incentive-ledger")

urlpatterns = [path("", include(router.urls))]
