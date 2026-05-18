from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import OTPRequestView, OTPVerifyView, UserViewSet

router = DefaultRouter()
router.register("users", UserViewSet)

urlpatterns = [
    path("otp/request/", OTPRequestView.as_view(), name="otp-request"),
    path("otp/verify/", OTPVerifyView.as_view(), name="otp-verify"),
    path("", include(router.urls)),
]
