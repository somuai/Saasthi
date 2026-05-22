from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import FirebaseVerifyView, OTPRequestView, OTPVerifyView, UserViewSet

router = DefaultRouter()
router.register("users", UserViewSet)

urlpatterns = [
    path("otp/request/", OTPRequestView.as_view(), name="otp-request"),
    path("otp/verify/", OTPVerifyView.as_view(), name="otp-verify"),
    path("firebase/verify/", FirebaseVerifyView.as_view(), name="firebase-verify"),
    path("", include(router.urls)),
]
