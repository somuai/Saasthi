"""
RECOMMENDATION TEST: Verify offline timestamp preservation

This test validates that when an ASHA worker fills a survey offline at 10am
and syncs 8 hours later (6pm), the survey.submitted_at remains 10am (client time),
not 6pm (server time).

This is critical for offline-first applications where connectivity is intermittent.
"""

import uuid
from datetime import timedelta

import pytest
from django.utils import timezone
from surveys.models import SurveyResponse
from sync.models import SyncEvent


@pytest.mark.django_db
def test_sync_push_preserves_offline_timestamp(auth_client, sample_patient):
    """
    Scenario: ASHA fills survey at 10am (offline), syncs at 6pm
    Expected: survey.submitted_at = 10am (NOT 6pm server time)
    """
    survey_uuid = uuid.uuid4()

    # Simulate offline survey filled 8 hours ago
    offline_time = timezone.now() - timedelta(hours=8)
    offline_timestamp_iso = offline_time.isoformat()

    # Push survey with old timestamp
    changes = {
        "survey_responses": {
            "created": [
                {
                    "id": str(survey_uuid),
                    "patient_id": str(sample_patient.local_uuid),
                    "survey_type": "initial",
                    "answers": {"fever": False, "rash": True},
                    "score_snapshot": {"risk_level": "moderate"},
                    "submitted_at": offline_timestamp_iso,  # ← OLD TIME (offline)
                }
            ],
            "updated": [],
            "deleted": [],
        }
    }

    # Sync to server NOW (current time)
    resp = auth_client.post("/api/v1/sync/push/", {"device_id": "phone-123", "changes": changes}, format="json")

    assert resp.status_code == 200
    assert resp.data["results"][0]["status"] == SyncEvent.Status.APPLIED

    # Verify the survey was stored with OFFLINE timestamp, not NOW
    survey = SurveyResponse.objects.get(local_uuid=survey_uuid)

    # ✅ CRITICAL ASSERTION
    # submitted_at should match the client's offline time, NOT server's now()
    assert survey.submitted_at == offline_time, (
        f"Timestamp not preserved! Expected: {offline_time}, Got: {survey.submitted_at}"
    )

    # synced_at should be near NOW (recent sync)
    assert survey.synced_at is not None
    assert (timezone.now() - survey.synced_at).total_seconds() < 5

    # The two timestamps should be DIFFERENT (offline gap of ~8 hours)
    time_diff = survey.synced_at - survey.submitted_at
    assert time_diff.total_seconds() > 3600, (
        f"Should have ~8 hour gap between submitted_at and synced_at, got {time_diff.total_seconds()} seconds"
    )


@pytest.mark.django_db
def test_sync_push_updates_preserve_timestamp(auth_client, sample_patient):
    """
    Scenario: ASHA edits survey (originally filled offline), syncs later
    Expected: submitted_at (original time) should NOT change on update
    """
    survey_uuid = uuid.uuid4()
    original_time = timezone.now() - timedelta(hours=12)
    original_timestamp_iso = original_time.isoformat()

    # Create survey with original timestamp
    SurveyResponse.objects.create(
        local_uuid=survey_uuid,
        patient=sample_patient,
        survey_type="initial",
        answers={"fever": False},
        submitted_at=original_time,
        created_by=None,
    )

    # ASHA edits the survey 8 hours later and syncs
    # submitted_at should NOT be updated
    changes = {
        "survey_responses": {
            "created": [],
            "updated": [
                {
                    "id": str(survey_uuid),
                    "patient_id": str(sample_patient.local_uuid),
                    "survey_type": "initial",
                    "answers": {"fever": True, "rash": False},  # Updated answers
                    "submitted_at": original_timestamp_iso,  # Same timestamp as original
                }
            ],
            "deleted": [],
        }
    }

    resp = auth_client.post("/api/v1/sync/push/", {"device_id": "phone-123", "changes": changes}, format="json")

    assert resp.status_code == 200
    assert resp.data["results"][0]["status"] == SyncEvent.Status.APPLIED

    # Verify:
    # 1. Answers were updated
    # 2. submitted_at was NOT changed
    survey = SurveyResponse.objects.get(local_uuid=survey_uuid)
    assert survey.answers["fever"] is True  # ✅ Update applied
    assert survey.submitted_at == original_time  # ✅ Timestamp preserved


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
