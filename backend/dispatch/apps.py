from django.apps import AppConfig


class DispatchConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "dispatch"
    verbose_name = "Emergency Dispatch"

    def ready(self):
        import dispatch.signals  # noqa: F401
