from .models import Flag


def dedupe_key(patient, flag_type, source):
    return f"{patient.local_uuid}:{flag_type}:{source}:open"


def upsert_flag(patient, flag_type, source="manual", severity="medium", score=0, explanation=None, created_by=None):
    key = dedupe_key(patient, flag_type, source)
    flag, created = Flag.objects.get_or_create(
        dedupe_key=key,
        defaults={
            "patient": patient,
            "flag_type": flag_type,
            "source": source,
            "severity": severity,
            "score": score,
            "explanation": explanation or {},
            "created_by": created_by,
        },
    )
    return flag, created


def create_flags_for_assessment(assessment, created_by=None):
    created_flags = []
    for explanation in assessment.explanations:
        flag, created = upsert_flag(
            assessment.patient,
            explanation.get("flag_type", "clinical_risk"),
            source="risk_engine",
            severity=explanation.get("severity", assessment.level),
            score=assessment.total_score,
            explanation={"assessment": str(assessment.local_uuid), "rule": explanation},
            created_by=created_by if getattr(created_by, "is_authenticated", False) else None,
        )
        if created:
            created_flags.append(flag)
    return created_flags


# ──────────────────────────────────────────────
# Follow-up auto-scheduling
# ──────────────────────────────────────────────

URGENCY_DAYS = {
    "immediate": 1,
    "within_24h": 1,
    "within_3_days": 3,
    "routine": 14,
}


def auto_schedule_followups(assessment):
    """
    Auto-create follow-up CareInteraction records when a medium/high
    risk assessment is completed.  Uses the recommended_urgency to decide
    the due-date offset.
    """
    from datetime import timedelta

    from django.utils import timezone
    from mcp.models import CareInteraction

    if assessment.level not in ("medium", "high"):
        return []

    days_offset = URGENCY_DAYS.get(assessment.recommended_urgency, 14)
    due_date = timezone.now() + timedelta(days=days_offset)

    protocol = f"followup:{assessment.level}:{assessment.recommended_urgency}"

    # Deduplicate — don't create duplicates for same patient + protocol within 24h
    recent = CareInteraction.objects.filter(
        patient=assessment.patient,
        protocol=protocol,
        created_at__gte=timezone.now() - timedelta(hours=24),
    ).exists()
    if recent:
        return []

    followup = CareInteraction.objects.create(
        patient=assessment.patient,
        protocol=protocol,
        notes=(
            f"Auto-scheduled follow-up | "
            f"Risk: {assessment.level} | "
            f"Urgency: {assessment.recommended_urgency} | "
            f"Due: {due_date.strftime('%Y-%m-%d')}"
        ),
        occurred_at=due_date,
        payload={
            "type": "scheduled_followup",
            "assessment_uuid": str(assessment.local_uuid),
            "risk_level": assessment.level,
            "urgency": assessment.recommended_urgency,
            "due_date": due_date.isoformat(),
            "status": "pending",
        },
    )
    return [followup]
