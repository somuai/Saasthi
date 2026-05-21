from django.apps import AppConfig


class RiskEngineConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "risk_engine"

    def ready(self):
        import os
        from risk_engine.gemma_service import gemma_service
        api_key = os.getenv("GEMMA_API_KEY") or os.getenv("GOOGLE_API_KEY") or "mock"
        gemma_service.init_gemma(api_key)
