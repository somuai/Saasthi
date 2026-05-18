from django.apps import AppConfig


class FlaggingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.flagging"
    label = "flagging"
