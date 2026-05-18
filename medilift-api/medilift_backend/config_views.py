from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from risk_engine.serializers import RiskRuleSerializer
from risk_engine.models import RiskRule


class BootstrapConfigView(APIView):
    authentication_classes = []
    permission_classes = []

    def get(self, request):
        return Response(
            {
                "app": "SAASTHI",
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

    def get(self, request):
        rules = RiskRule.objects.filter(is_active=True).order_by("code")
        return Response({"rules": RiskRuleSerializer(rules, many=True).data})
