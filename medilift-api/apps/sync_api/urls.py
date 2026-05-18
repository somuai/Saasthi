from django.urls import path
from . import views

urlpatterns = [
    path("pull/", views.SyncPullView.as_view(), name="sync-pull"),
    path("push/", views.SyncPushView.as_view(), name="sync-push"),
]
