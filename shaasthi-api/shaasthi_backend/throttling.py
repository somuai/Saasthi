from rest_framework.throttling import ScopedRateThrottle, UserRateThrottle


class SyncPushThrottle(ScopedRateThrottle):
    scope = "sync_push"


class SurveyWriteThrottle(ScopedRateThrottle):
    scope = "survey_write"


class RiskAssessmentThrottle(ScopedRateThrottle):
    scope = "risk_assess"
