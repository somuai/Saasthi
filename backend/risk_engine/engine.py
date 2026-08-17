"""Dynamic rule-based risk classification engine (v2)."""

from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass
from typing import Any

from django.db.models import Q, Sum
from django.utils import timezone

from .models import RiskAssessment, RiskRule

logger = logging.getLogger(__name__)


MCP_ROOT_MODELS = {
    "anc": "ancvisit",
    "growth": "growthrecord",
    "pnc": "pncvisit",
    "milestone": "developmentmilestonecheck",
    "immunization": "immunizationrecord",
    "delivery": "deliveryrecord",
}


def resolve_path(patient, survey_response, field_path: str, mcp_instance=None) -> Any:
    """Resolve dot-notation paths; never raises.
    Supports patient.*, survey.*, and MCP roots (anc.*, growth.*, pnc.*,
    milestone.*, immunization.*, delivery.*) resolved from mcp_instance.
    """
    if not field_path:
        return None
    parts = field_path.split(".")
    root = parts[0]

    try:
        if root == "patient":
            obj = patient
            for part in parts[1:]:
                if obj is None:
                    return None
                if isinstance(obj, dict):
                    obj = obj.get(part)
                elif part == "metadata" and hasattr(obj, "metadata"):
                    obj = obj.metadata or {}
                else:
                    obj = getattr(obj, part, None)
            return obj

        if root == "survey":
            if survey_response is None:
                return None
            if len(parts) >= 2 and parts[1] == "answers":
                answers = getattr(survey_response, "answers", None) or {}
                if not isinstance(answers, dict):
                    return None
                key = ".".join(parts[2:]) if len(parts) > 2 else None
                if not key:
                    return answers
                if key in answers:
                    return answers[key]
                cur = answers
                for segment in parts[2:]:
                    if not isinstance(cur, dict):
                        return None
                    cur = cur.get(segment)
                return cur
            obj = survey_response
            for part in parts[1:]:
                if obj is None:
                    return None
                obj = obj.get(part) if isinstance(obj, dict) else getattr(obj, part, None)
            return obj

        # MCP model roots — resolve against the mcp_instance
        model_key = root.lower()
        if model_key in MCP_ROOT_MODELS:
            if mcp_instance is None:
                return None
            mcp_model_key = MCP_ROOT_MODELS[model_key]
            actual_model = mcp_model_key.lower().replace(" ", "")
            if not _model_matches(mcp_instance, actual_model):
                return None
            obj = mcp_instance
            for part in parts[1:]:
                if obj is None:
                    return None
                obj = obj.get(part) if isinstance(obj, dict) else getattr(obj, part, None)
            return obj

    except (KeyError, AttributeError, TypeError):
        logger.warning("resolve_value failed for path=%s patient=%s", field_path, patient, exc_info=True)
        return None


def _model_matches(instance, expected_key):
    name = instance._meta.model_name.lower().replace(" ", "")
    return name == expected_key


def expected_value_from_rule(rule: RiskRule) -> Any:
    raw = rule.value
    if isinstance(raw, dict) and "value" in raw:
        return raw["value"]
    return raw


def compare(actual: Any, operator: str, expected: Any) -> bool:
    """Pure operator evaluation; None actual is non-matching except falsy."""
    if actual is None and operator not in (RiskRule.Operator.FALSY,):
        return False

    try:
        if operator == RiskRule.Operator.TRUTHY:
            return bool(actual)
        if operator == RiskRule.Operator.FALSY:
            return not bool(actual)
        if operator == RiskRule.Operator.EQ:
            return str(actual).lower() == str(expected).lower()
        if operator == RiskRule.Operator.NOT_EQ:
            return str(actual).lower() != str(expected).lower()
        if operator == RiskRule.Operator.GTE:
            return float(actual) >= float(expected)
        if operator == RiskRule.Operator.GT:
            return float(actual) > float(expected)
        if operator == RiskRule.Operator.LTE:
            return float(actual) <= float(expected)
        if operator == RiskRule.Operator.LT:
            return float(actual) < float(expected)
        if operator == RiskRule.Operator.CONTAINS:
            return str(expected).lower() in str(actual).lower()
        if operator == RiskRule.Operator.IN:
            items = expected if isinstance(expected, list) else [expected]
            return str(actual).lower() in [str(item).lower() for item in items]
    except (TypeError, ValueError):
        return False
    return False


def level_for_score(score: int) -> str:
    if score >= 8:
        return "high"
    if score >= 4:
        return "medium"
    return "low"


RECOMMENDATION_TEMPLATES = {
    ("high", "communicable"): {
        "en": "Refer to PHC within 24 hours. Possible infectious disease.",
        "hi": "24 घंटे के अंदर PHC में भेजें। संभावित संक्रामक रोग।",
        "urgency": "within_24h",
    },
    ("high", "chronic"): {
        "en": "Refer to PHC within 24 hours. Chronic condition needs clinical review.",
        "hi": "24 घंटे के अंदर PHC में भेजें। दीर्घकालिक स्थिति की जांच ज़रूरी।",
        "urgency": "within_24h",
    },
    ("high", "critical"): {
        "en": "EMERGENCY — refer to hospital immediately. Do not delay.",
        "hi": "आपातकाल — तुरंत अस्पताल भेजें। देरी न करें।",
        "urgency": "immediate",
    },
    ("high", "maternal"): {
        "en": "Refer to PHC/CHC immediately. High-risk pregnancy.",
        "hi": "PHC/CHC में तुरंत भेजें। उच्च जोखिम गर्भावस्था।",
        "urgency": "immediate",
    },
    ("high", "child"): {
        "en": "Refer to CHC/NRC immediately. Child at high risk.",
        "hi": "तुरंत CHC/NRC भेजें। बच्चे को उच्च जोखिम है।",
        "urgency": "immediate",
    },
    ("medium", "child"): {
        "en": "Schedule CHC visit within 3 days. Monitor child nutrition and growth.",
        "hi": "3 दिनों में CHC विज़िट शेड्यूल करें। बच्चे के पोषण और विकास की निगरानी करें।",
        "urgency": "within_3_days",
    },
    ("medium", "general"): {
        "en": "Schedule PHC visit within 3 days. Monitor symptoms daily.",
        "hi": "3 दिनों में PHC विजिट शेड्यूल करें। रोज़ लक्षण देखें।",
        "urgency": "within_3_days",
    },
    ("low", "general"): {
        "en": "Continue monitoring. Follow up in 2 weeks.",
        "hi": "निगरानी जारी रखें। 2 हफ्ते में फिर मिलें।",
        "urgency": "routine",
    },
}

PROTOCOL_CHECKLIST_TEMPLATES = {
    "hard_flag": [
        {"hi": "मरीज को अकेले न जाने दें", "en": "Do not let patient go alone"},
        {"hi": "आपात संकेत हों तो 108 कॉल करें", "en": "Call 108 if any danger sign"},
        {"hi": "ANM को अभी सूचना दें", "en": "Call ANM immediately"},
        {"hi": "MCP कार्ड या रजिस्टर में रेफरल लिखें", "en": "Document referral in MCP card/register"},
    ],
    "high": [
        {"hi": "परिवार को मुख्य जोखिम बताएं", "en": "Tell family key risk factors"},
        {"hi": "आज की तारीख रजिस्टर में लिखें", "en": "Write today's date in register"},
        {"hi": "ANM सुपरवाइजर को सूचित करें", "en": "Inform ANM supervisor"},
        {"hi": "24 घंटे में फॉलो-अप तय करें", "en": "Schedule follow-up within 24 hours"},
    ],
    "medium": [
        {"hi": "परिवार से जोखिम कारण पर बात करें", "en": "Discuss key risk factors with family"},
        {"hi": "3 दिन में फॉलो-अप करें", "en": "Schedule follow-up in 3 days"},
        {"hi": "घर/मरीज रजिस्टर अपडेट करें", "en": "Update household register"},
    ],
    "low": [
        {"hi": "परिवार को निगरानी जारी रखने को कहें", "en": "Ask family to continue monitoring"},
        {"hi": "2 हफ्ते में नियमित फॉलो-अप करें", "en": "Plan routine follow-up in 2 weeks"},
    ],
}


@dataclass
class AssessmentResult:
    total_score: int
    level: str
    explanations: list
    rules_version: str
    rules_snapshot: list
    triggered_by_hard_flag: bool
    hard_flag_rule_id: int | None
    normalized_score: int | None
    primary_category: str
    secondary_categories: list
    recommended_action_en: str
    recommended_action_hi: str
    recommended_urgency: str
    protocol_checklist: list = None
    hard_flag_category: str = ""
    recommendation_source: str = "rule_template"
    score_source: str = "rule_engine"
    rule_engine_score: int | None = None
    ml_score: float | None = None
    ml_confidence: float | None = None
    ml_model_version: int | None = None


class RiskEngine:
    """Evaluate patient + survey against active rules with optional as-of timestamp."""

    def _as_of(self, surveyed_at=None):
        return surveyed_at or timezone.now()

    def _active_rules_queryset(self, as_of):
        # Temporal filter only — supports offline as-of replay via deactivated_at.
        # is_active is kept for admin UI; do not filter it here (breaks historical replay).
        return (
            RiskRule.objects.filter(created_at__lte=as_of)
            .filter(Q(deactivated_at__isnull=True) | Q(deactivated_at__gt=as_of))
            .order_by("-is_hard_flag", "code")
        )

    def get_active_rules(self, as_of=None):
        return list(self._active_rules_queryset(self._as_of(as_of)))

    def get_max_theoretical_score(self, as_of=None) -> int:
        as_of = self._as_of(as_of)
        total = self._active_rules_queryset(as_of).filter(is_hard_flag=False).aggregate(total=Sum("weight"))["total"]
        return total or 1

    def build_rules_snapshot(self, rules) -> list:
        return [
            {
                "id": rule.id,
                "code": rule.code,
                "field_path": rule.field_path,
                "operator": rule.operator,
                "expected_value": rule.value,
                "weight": rule.weight,
                "category": rule.category,
                "is_hard_flag": rule.is_hard_flag,
                "rule_label_en": rule.rule_label_en,
                "rule_label_hi": rule.rule_label_hi,
            }
            for rule in rules
        ]

    def derive_categories(self, matched_rules) -> dict:
        category_scores = defaultdict(int)
        for rule, _ in matched_rules:
            category_scores[rule.category] += rule.weight
        if not category_scores:
            return {"primary": RiskRule.Category.GENERAL, "secondary": []}
        sorted_cats = sorted(category_scores.items(), key=lambda item: item[1], reverse=True)
        return {
            "primary": sorted_cats[0][0],
            "secondary": [cat for cat, score in sorted_cats[1:] if score > 0],
        }

    def build_explanations(self, matched_rules) -> list:
        explanations = []
        for rule, actual_value in matched_rules:
            explanations.append(
                {
                    "code": rule.code,
                    "name": rule.name,
                    "rule_id": rule.id,
                    "rule_label_en": rule.rule_label_en or rule.name,
                    "rule_label_hi": rule.rule_label_hi or rule.name,
                    "field_path": rule.field_path,
                    "operator": rule.operator,
                    "expected": expected_value_from_rule(rule),
                    "expected_value": expected_value_from_rule(rule),
                    "actual": actual_value,
                    "actual_value": actual_value,
                    "weight": rule.weight,
                    "weight_contributed": rule.weight,
                    "severity": rule.severity,
                    "flag_type": rule.flag_type,
                    "category": rule.category,
                }
            )
        return explanations

    def get_recommendation(self, risk_level: str, primary_category: str) -> dict:
        key = (risk_level, primary_category)
        fallback = (risk_level, RiskRule.Category.GENERAL)
        return RECOMMENDATION_TEMPLATES.get(
            key,
            RECOMMENDATION_TEMPLATES.get(
                fallback,
                {
                    "en": "Consult supervisor for guidance.",
                    "hi": "मार्गदर्शन के लिए पर्यवेक्षक से सलाह लें।",
                    "urgency": "routine",
                },
            ),
        )

    def _build_protocol_checklist(self, risk_level: str, primary_category: str, is_hard_flag: bool) -> list:
        if is_hard_flag:
            return PROTOCOL_CHECKLIST_TEMPLATES.get("hard_flag", [])
        return PROTOCOL_CHECKLIST_TEMPLATES.get(risk_level, PROTOCOL_CHECKLIST_TEMPLATES["low"])

    def evaluate(
        self, patient, survey_response=None, surveyed_at=None, mcp_instance=None, population=None
    ) -> AssessmentResult:
        as_of = self._as_of(surveyed_at)
        active_rules = self.get_active_rules(as_of=as_of)
        if population:
            active_rules = [
                r
                for r in active_rules
                if r.category == population or r.category in ("general", "communicable", "chronic", "critical")
            ]
        snapshot = self.build_rules_snapshot(active_rules)

        for rule in active_rules:
            if not rule.is_hard_flag:
                continue
            actual = resolve_path(patient, survey_response, rule.field_path, mcp_instance=mcp_instance)
            expected = expected_value_from_rule(rule)
            if compare(actual, rule.operator, expected):
                rec_en = rule.hard_flag_message_en or "Emergency referral required"
                rec_hi = rule.hard_flag_message_hi or "आपातकालीन रेफरल आवश्यक"
                explanations = [
                    {
                        "code": rule.code,
                        "name": rule.name,
                        "rule_id": rule.id,
                        "rule_label_en": rule.rule_label_en or "Critical condition detected",
                        "rule_label_hi": rule.rule_label_hi or "गंभीर स्थिति पाई गई",
                        "field_path": rule.field_path,
                        "operator": rule.operator,
                        "expected": expected,
                        "expected_value": expected,
                        "actual": actual,
                        "actual_value": actual,
                        "weight": rule.weight,
                        "weight_contributed": rule.weight,
                        "severity": "high",
                        "flag_type": rule.flag_type,
                        "category": rule.category or RiskRule.Category.CRITICAL,
                    }
                ]
                return AssessmentResult(
                    total_score=0,
                    level="high",
                    explanations=explanations,
                    rules_version=f"{rule.code}:{rule.version}",
                    rules_snapshot=snapshot,
                    triggered_by_hard_flag=True,
                    hard_flag_rule_id=rule.id,
                    normalized_score=100,
                    primary_category=rule.category or RiskRule.Category.CRITICAL,
                    secondary_categories=[],
                    recommended_action_en=rec_en,
                    recommended_action_hi=rec_hi,
                    recommended_urgency="immediate",
                    protocol_checklist=self._build_protocol_checklist("hard_flag", rule.category, is_hard_flag=True),
                    hard_flag_category=rule.category or RiskRule.Category.CRITICAL,
                    recommendation_source=rule.flag_type if rule.is_hard_flag else "rule_template",
                    score_source="rule_engine",
                    rule_engine_score=0,
                    ml_score=None,
                    ml_confidence=None,
                    ml_model_version=None,
                )

        total_score = 0
        matched_rules = []
        for rule in active_rules:
            if rule.is_hard_flag:
                continue
            actual = resolve_path(patient, survey_response, rule.field_path, mcp_instance=mcp_instance)
            expected = expected_value_from_rule(rule)
            if compare(actual, rule.operator, expected):
                total_score += rule.weight
                matched_rules.append((rule, actual))

        risk_level = level_for_score(total_score)
        max_score = self.get_max_theoretical_score(as_of=as_of)
        normalized_score = min(round((total_score / max_score) * 100), 100)
        categories = self.derive_categories(matched_rules)
        explanations = self.build_explanations(matched_rules)
        recommendation = self.get_recommendation(risk_level, categories["primary"])
        versions = ",".join(f"{rule.code}:{rule.version}" for rule, _ in matched_rules)

        return AssessmentResult(
            total_score=total_score,
            level=risk_level,
            explanations=explanations,
            rules_version=versions,
            rules_snapshot=snapshot,
            triggered_by_hard_flag=False,
            hard_flag_rule_id=None,
            normalized_score=normalized_score,
            primary_category=categories["primary"],
            secondary_categories=categories["secondary"],
            recommended_action_en=recommendation["en"],
            recommended_action_hi=recommendation["hi"],
            recommended_urgency=recommendation["urgency"],
            protocol_checklist=self._build_protocol_checklist(risk_level, categories["primary"], is_hard_flag=False),
            hard_flag_category="",
            recommendation_source="rule_template",
            score_source="rule_engine",
            rule_engine_score=total_score,
            ml_score=None,
            ml_confidence=None,
            ml_model_version=None,
        )

    def create_assessment(
        self,
        patient,
        survey_response=None,
        surveyed_at=None,
        *,
        save: bool = True,
        mcp_instance=None,
        population=None,
    ) -> RiskAssessment:
        result = self.evaluate(
            patient, survey_response, surveyed_at=surveyed_at, mcp_instance=mcp_instance, population=population
        )
        assessment = RiskAssessment(
            patient=patient,
            survey_response=survey_response,
            total_score=result.total_score,
            level=result.level,
            explanations=result.explanations,
            rules_version=result.rules_version,
            rules_snapshot=result.rules_snapshot,
            triggered_by_hard_flag=result.triggered_by_hard_flag,
            hard_flag_rule_id=result.hard_flag_rule_id,
            normalized_score=result.normalized_score,
            primary_category=result.primary_category,
            secondary_categories=result.secondary_categories,
            surveyed_at=surveyed_at,
            recommended_action_en=result.recommended_action_en,
            recommended_action_hi=result.recommended_action_hi,
            recommended_urgency=result.recommended_urgency,
            protocol_checklist=result.protocol_checklist or [],
            hard_flag_category=result.hard_flag_category or "",
            recommendation_source=result.recommendation_source,
            score_source=result.score_source,
            rule_engine_score=result.rule_engine_score,
            ml_score=result.ml_score,
            ml_confidence=result.ml_confidence,
            ml_model_version=result.ml_model_version,
        )
        if save:
            assessment.save()
        return assessment


def assess(patient, survey_response=None, surveyed_at=None):
    """Backward-compatible dict return for tests and legacy callers."""
    engine = RiskEngine()
    result = engine.evaluate(patient, survey_response, surveyed_at=surveyed_at)
    return {
        "total_score": result.total_score,
        "level": result.level,
        "explanations": result.explanations,
        "rules_version": result.rules_version,
        "rules_snapshot": result.rules_snapshot,
        "triggered_by_hard_flag": result.triggered_by_hard_flag,
        "hard_flag_rule_id": result.hard_flag_rule_id,
        "normalized_score": result.normalized_score,
        "primary_category": result.primary_category,
        "secondary_categories": result.secondary_categories,
        "recommended_action_en": result.recommended_action_en,
        "recommended_action_hi": result.recommended_action_hi,
        "recommended_urgency": result.recommended_urgency,
        "protocol_checklist": result.protocol_checklist or [],
        "hard_flag_category": result.hard_flag_category or "",
        "recommendation_source": result.recommendation_source,
        "score_source": result.score_source,
        "rule_engine_score": result.rule_engine_score,
        "ml_score": result.ml_score,
        "ml_confidence": result.ml_confidence,
        "ml_model_version": result.ml_model_version,
    }
