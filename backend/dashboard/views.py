from django.views.generic import TemplateView


class DashboardSPAView(TemplateView):
    template_name = "dashboard/index.html"
