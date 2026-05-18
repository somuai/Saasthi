from django.urls import path

from .config_views import BootstrapConfigView, RulesConfigView

urlpatterns = [
    path("bootstrap/", BootstrapConfigView.as_view(), name="config-bootstrap"),
    path("rules/", RulesConfigView.as_view(), name="config-rules"),
]
