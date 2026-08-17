from analytics.hmis_export import HMISReportExportView
from analytics.outbreaks import OutbreakAlertView
from django.urls import path

from . import views

urlpatterns = [
    path("summary/", views.DashboardSummary.as_view(), name="dash-summary"),
    path("analytics/overview/", views.AnalyticsOverview.as_view(), name="dash-analytics-overview"),
    path("analytics/trends/", views.AnalyticsTrendData.as_view(), name="dash-analytics-trends"),
    path("analytics/workers/<int:pk>/scorecard/", views.WorkerScorecard.as_view(), name="dash-worker-scorecard"),
    path("activity/", views.RecentActivity.as_view(), name="dash-activity"),
    path("patients/", views.PatientListCreate.as_view(), name="dash-patients-list"),
    path("patients/<int:pk>/", views.PatientDetail.as_view(), name="dash-patients-detail"),
    path("patients/<int:pk>/mcp/", views.PatientMCPDataView.as_view(), name="dash-patients-mcp"),
    path("ashas/", views.ASHAList.as_view(), name="dash-ashas"),
    path("ashas/<int:pk>/", views.ASHADetail.as_view(), name="dash-ashas-detail"),
    path("flags/", views.FlagList.as_view(), name="dash-flags-list"),
    path("flags/<int:pk>/", views.FlagUpdate.as_view(), name="dash-flags-update"),
    path("incentives/", views.IncentiveList.as_view(), name="dash-incentives-list"),
    path("incentives/<int:pk>/approve/", views.IncentiveApprove.as_view(), name="dash-incentives-approve"),
    path("incentives/<int:pk>/pay/", views.IncentivePay.as_view(), name="dash-incentives-pay"),
    path("referrals/", views.ReferralList.as_view(), name="dash-referrals-list"),
    path("referrals/<int:pk>/", views.ReferralUpdate.as_view(), name="dash-referrals-update"),
    path("commands/", views.CommandRunner.as_view(), name="dash-commands"),
    path("outbreaks/", OutbreakAlertView.as_view(), name="dash-outbreaks"),
    path("reports/hmis-export/", HMISReportExportView.as_view(), name="dash-hmis-export"),
]
