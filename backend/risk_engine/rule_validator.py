"""Validate risk rules at creation time."""

from __future__ import annotations

from dataclasses import dataclass, field

from django.db.models import Q
from django.utils import timezone

from .engine import expected_value_from_rule
from .models import RiskRule


@dataclass
class RuleConflictWarning:
    conflicting_rule_id: int | None
    conflict_type: str
    message: str

    def to_dict(self):
        return {
            "conflicting_rule_id": self.conflicting_rule_id,
            "conflict_type": self.conflict_type,
            "message": self.message,
        }


@dataclass
class RuleValidationResult:
    is_valid: bool = True
    warnings: list[RuleConflictWarning] = field(default_factory=list)

    def to_dict(self):
        return {
            "is_valid": self.is_valid,
            "warnings": [w.to_dict() for w in self.warnings],
        }


class RuleValidator:
    def __init__(self, exclude_rule_id: int | None = None):
        self.exclude_rule_id = exclude_rule_id

    def _active_rules_for_path(self, field_path: str):
        now = timezone.now()
        qs = (
            RiskRule.objects.filter(field_path=field_path)
            .filter(Q(deactivated_at__isnull=True) | Q(deactivated_at__gt=now))
            .filter(is_active=True)
        )
        if self.exclude_rule_id:
            qs = qs.exclude(pk=self.exclude_rule_id)
        return qs

    @staticmethod
    def is_valid_field_path(path: str) -> bool:
        valid_prefixes = ("patient.", "survey.answers.", "anc.", "growth.", "pnc.", "milestone.", "immunization.", "delivery.")
        return path.startswith(valid_prefixes)

    @staticmethod
    def are_numeric_ranges_overlapping(existing: RiskRule, new_operator: str, new_value) -> bool:
        numeric_ops = {
            RiskRule.Operator.GTE,
            RiskRule.Operator.GT,
            RiskRule.Operator.LTE,
            RiskRule.Operator.LT,
        }
        if existing.operator not in numeric_ops or new_operator not in numeric_ops:
            return False
        try:
            a_val = float(expected_value_from_rule(existing))
            b_val = float(new_value if not isinstance(new_value, dict) else new_value.get("value", new_value))
            return abs(a_val - b_val) < 5
        except (TypeError, ValueError):
            return False

    def validate(self, rule_data: dict) -> RuleValidationResult:
        warnings: list[RuleConflictWarning] = []
        field_path = rule_data.get("field_path", "")
        operator = rule_data.get("operator")
        expected = rule_data.get("value", {})
        expected_scalar = expected["value"] if isinstance(expected, dict) and "value" in expected else expected

        for rule in self._active_rules_for_path(field_path):
            existing_expected = expected_value_from_rule(rule)
            if rule.operator == operator and str(existing_expected) == str(expected_scalar):
                warnings.append(
                    RuleConflictWarning(
                        conflicting_rule_id=rule.id,
                        conflict_type="duplicate",
                        message=(
                            f"Exact duplicate of rule #{rule.id} (weight: {rule.weight}). "
                            "Both will fire on the same data."
                        ),
                    )
                )
            if self.are_numeric_ranges_overlapping(rule, operator, expected):
                warnings.append(
                    RuleConflictWarning(
                        conflicting_rule_id=rule.id,
                        conflict_type="overlapping",
                        message=(
                            f"Overlaps with rule #{rule.id}: {rule.field_path} {rule.operator} {existing_expected}."
                        ),
                    )
                )

        if not self.is_valid_field_path(field_path):
            warnings.append(
                RuleConflictWarning(
                    conflicting_rule_id=None,
                    conflict_type="invalid_path",
                    message=(
                        f"Field path '{field_path}' should start with 'patient.' or "
                        "'survey.answers.' — rule may never fire."
                    ),
                )
            )

        if rule_data.get("is_hard_flag") and not rule_data.get("hard_flag_message_en"):
            warnings.append(
                RuleConflictWarning(
                    conflicting_rule_id=None,
                    conflict_type="missing_message",
                    message=(
                        "Hard flag rules should have hard_flag_message_en to explain the emergency to ASHA workers."
                    ),
                )
            )

        return RuleValidationResult(is_valid=True, warnings=warnings)
