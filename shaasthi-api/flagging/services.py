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
