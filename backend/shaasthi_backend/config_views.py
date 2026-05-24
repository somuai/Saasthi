import os

from accounts.models import User
from drf_spectacular.utils import extend_schema
from rest_framework.response import Response
from rest_framework.views import APIView
from risk_engine.models import RiskRule
from risk_engine.serializers import RiskRuleSerializer


class AppVersionView(APIView):
    authentication_classes = []
    permission_classes = []

    @extend_schema(responses={200: {"type": "object"}})
    def get(self, request):
        return Response(
            {
                "min_version": os.environ.get("APP_MIN_VERSION", "1.0.0"),
                "current_version": os.environ.get("APP_CURRENT_VERSION", "1.0.0"),
                "update_url": os.environ.get("APP_UPDATE_URL", None),
                "force_update": os.environ.get("APP_FORCE_UPDATE", "false").lower() in ("true", "1", "yes"),
            }
        )


class BootstrapConfigView(APIView):
    authentication_classes = []
    permission_classes = []

    @extend_schema(responses={200: {"type": "object"}})
    def get(self, request):
        return Response(
            {
                "app": "SHAASTHI",
                "api_version": "v1",
                "roles": [choice[0] for choice in User.Role.choices],
                "gender_choices": ["female", "male", "other", "unknown"],
                "flag_statuses": ["open", "acknowledged", "resolved", "dismissed"],
                "sync_models": ["patient", "survey_response", "flag", "referral"],
            }
        )


class RulesConfigView(APIView):
    authentication_classes = []
    permission_classes = []

    @extend_schema(responses={200: {"type": "object"}})
    def get(self, request):
        rules = RiskRule.objects.filter(is_active=True).order_by("code")
        return Response({"rules": RiskRuleSerializer(rules, many=True).data})
