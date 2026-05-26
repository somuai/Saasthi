from django.apps import AppConfig


class IncentivesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "incentives"

    def ready(self):
        import incentives.signals  # noqa: F401
