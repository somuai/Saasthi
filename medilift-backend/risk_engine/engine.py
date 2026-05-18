from .models import RiskRule


def resolve_path(patient, survey_response, field_path):
    root, *parts = field_path.split(".")
    current = {"patient": patient, "survey": survey_response}.get(root)
    for part in parts:
        if current is None:
            return None
        if isinstance(current, dict):
            current = current.get(part)
        else:
            current = getattr(current, part, None)
    return current


def compare(actual, operator, expected):
    if operator == RiskRule.Operator.EQ:
        return actual == expected
    if operator == RiskRule.Operator.GTE:
        return actual is not None and actual >= expected
    if operator == RiskRule.Operator.LTE:
        return actual is not None and actual <= expected
    if operator == RiskRule.Operator.CONTAINS:
        return actual is not None and expected in actual
    if operator == RiskRule.Operator.TRUTHY:
        return bool(actual)
    return False


def level_for_score(score):
    if score >= 8:
        return "high"
    if score >= 4:
        return "medium"
    return "low"


def assess(patient, survey_response=None):
    explanations = []
    score = 0
    matched_rules = []
    for rule in RiskRule.objects.filter(is_active=True).order_by("code"):
        actual = resolve_path(patient, survey_response, rule.field_path)
        expected = rule.value.get("value") if isinstance(rule.value, dict) and "value" in rule.value else rule.value
        matched = compare(actual, rule.operator, expected)
        if matched:
            score += rule.weight
            matched_rules.append(rule)
            explanations.append(
                {
                    "code": rule.code,
                    "name": rule.name,
                    "field_path": rule.field_path,
                    "operator": rule.operator,
                    "expected": expected,
                    "actual": actual,
                    "weight": rule.weight,
                    "severity": rule.severity,
                    "flag_type": rule.flag_type,
                }
            )
    versions = ",".join(f"{rule.code}:{rule.version}" for rule in matched_rules)
    return {"total_score": score, "level": level_for_score(score), "explanations": explanations, "rules_version": versions}
