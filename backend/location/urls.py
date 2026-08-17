from django.urls import path

from location.views import LocationUpdateView, NearbyWorkersView

urlpatterns = [
    path("update/", LocationUpdateView.as_view(), name="location-update"),
    path("nearby-workers/", NearbyWorkersView.as_view(), name="nearby-workers"),
]
