"""Python mirror of mobile rule-based scorer (subset for server batch jobs)."""


def score_patient_dict(patient: dict, survey=None) -> dict:
    score = 0
    factors = []
    if patient.get("is_pregnant"):
        score += 22
        factors.append("pregnant")
    if patient.get("has_diabetes"):
        score += 18
    if patient.get("has_hypertension"):
        score += 16
    if survey:
        if survey.get("serious_severe_breathing") or survey.get("serious_chest_pain"):
            score += 35
        if survey.get("comm_cough_2weeks"):
            score += 22
    score = min(score, 100)
    if score <= 25:
        level = "low"
    elif score <= 50:
        level = "medium"
    elif score <= 75:
        level = "high"
    else:
        level = "critical"
    return {"score": score, "risk_level": level, "triggered_factors": factors}
