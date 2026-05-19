from django.urls import path

from .dashboard_views import FlagCSVExportView, SupervisorDashboardSummaryView

urlpatterns = [
    path("summary/", SupervisorDashboardSummaryView.as_view(), name="dashboard-summary"),
    path("export/flags.csv", FlagCSVExportView.as_view(), name="dashboard-flags-export"),
]
