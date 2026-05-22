from rest_framework.throttling import ScopedRateThrottle


class SyncPushThrottle(ScopedRateThrottle):
    scope = "sync_push"


class SurveyWriteThrottle(ScopedRateThrottle):
    scope = "survey_write"


class RiskAssessmentThrottle(ScopedRateThrottle):
    scope = "risk_assess"


class GemmaQueryThrottle(ScopedRateThrottle):
    scope = "gemma_query"
