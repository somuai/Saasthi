import uuid

import pytest

from registry.models import Patient
from sync.models import SyncEvent


@pytest.mark.django_db
def test_sync_push_is_idempotent_by_event_and_local_uuid(auth_client):
    event_uuid = uuid.uuid4()
    patient_uuid = uuid.uuid4()
    payload = {
        "device_id": "pilot-device-1",
        "changes": {
            "patients": {
                "created": [
                    {
                        "event_uuid": str(event_uuid),
                        "id": str(patient_uuid),
                        "full_name": "Maya Rao", 
                        "gender": "female", 
                        "village": "South"
                    }
                ],
                "updated": [],
                "deleted": []
            }
        },
    }

    first = auth_client.post("/api/v1/sync/push/", payload, format="json")
    second = auth_client.post("/api/v1/sync/push/", payload, format="json")
    update_payload = {
        "device_id": "pilot-device-1",
        "changes": {
            "patients": {
                "created": [],
                "updated": [
                    {
                        "event_uuid": str(uuid.uuid4()),
                        "id": str(patient_uuid),
                        "full_name": "Maya R.", 
                        "gender": "female", 
                        "village": "South"
                    }
                ],
                "deleted": []
            }
        },
    }
    third = auth_client.post("/api/v1/sync/push/", update_payload, format="json")

    assert first.status_code == 200
    assert first.data["results"][0]["status"] == SyncEvent.Status.APPLIED
    assert second.status_code == 200
    assert second.data["results"][0]["status"] == SyncEvent.Status.DUPLICATE
    assert third.status_code == 200
    assert Patient.objects.count() == 1
    assert Patient.objects.get(local_uuid=patient_uuid).full_name == "Maya R."
    assert SyncEvent.objects.count() == 2
