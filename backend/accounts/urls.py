from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    FirebasePNVVerifyView,
    FirebaseVerifyView,
    OTPRequestView,
    OTPVerifyView,
    UserViewSet,
    WorkerRegistrationViewSet,
)

router = DefaultRouter()
router.register("users", UserViewSet)
router.register("workers", WorkerRegistrationViewSet, basename="workers")

urlpatterns = [
    path("otp/request/", OTPRequestView.as_view(), name="otp-request"),
    path("otp/verify/", OTPVerifyView.as_view(), name="otp-verify"),
    path("firebase/verify/", FirebaseVerifyView.as_view(), name="firebase-verify"),
    path("firebase/pnv/verify/", FirebasePNVVerifyView.as_view(), name="firebase-pnv-verify"),
    path("", include(router.urls)),
]
