from django.urls import path
from django.views.generic import TemplateView

from .dashboard_views import ASHAMetricsView, FlagCSVExportView, SupervisorDashboardSummaryView
from .hmis_export import HMISReportExportView
from .outbreaks import OutbreakAlertView

urlpatterns = [
    path("summary/", SupervisorDashboardSummaryView.as_view(), name="dashboard-summary"),
    path("workers/<int:asha_id>/metrics/", ASHAMetricsView.as_view(), name="dashboard-asha-metrics"),
    path("export/flags.csv", FlagCSVExportView.as_view(), name="dashboard-flags-export"),
    path("outbreaks/", OutbreakAlertView.as_view(), name="dashboard-outbreaks"),
    path("reports/hmis-export/", HMISReportExportView.as_view(), name="dashboard-hmis-export"),
    path("", TemplateView.as_view(template_name="dashboard/overview.html"), name="dashboard-overview"),
]
