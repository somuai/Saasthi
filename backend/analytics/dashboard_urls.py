from django.urls import path
from django.views.generic import TemplateView

from .dashboard_views import FlagCSVExportView, SupervisorDashboardSummaryView

urlpatterns = [
    path("summary/", SupervisorDashboardSummaryView.as_view(), name="dashboard-summary"),
    path("export/flags.csv", FlagCSVExportView.as_view(), name="dashboard-flags-export"),
    path("", TemplateView.as_view(template_name="dashboard/overview.html"), name="dashboard-overview"),
]
