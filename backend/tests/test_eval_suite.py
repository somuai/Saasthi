import pytest
from accounts.models import User, WorkerRegistration
from django.test import override_settings
from followups.services.gps_service import classify_gps_visit


@pytest.mark.django_db
@override_settings(EXPOSE_DEBUG_OTP=True)
def test_supervisor_auth_bypass(api_client):
    """Test that a supervisor can request and verify OTP successfully without a WorkerRegistration."""
    phone = "+919900112233"
    User.objects.create_user(username="super_test_eval", phone=phone, role=User.Role.SUPERVISOR, is_active=True)

    # Request OTP
    resp_req = api_client.post("/api/v1/auth/otp/request/", {"phone": phone}, format="json")
    assert resp_req.status_code == 201
    code = resp_req.data["debug_otp"]

    # Verify OTP
    resp_ver = api_client.post("/api/v1/auth/otp/verify/", {"phone": phone, "code": code}, format="json")
    assert resp_ver.status_code == 200
    assert resp_ver.data["user"]["phone"] == phone
    assert resp_ver.data["user"]["role"] == User.Role.SUPERVISOR


@pytest.mark.django_db
def test_phone_number_normalization_on_worker_registration(api_client):
    """Verify that registering a worker with raw spaces / formatting normalizes phone to +91XXXXXXXXXX."""
    supervisor = User.objects.create_user(
        username="supervisor_norm", phone="+919999988888", role=User.Role.SUPERVISOR, is_active=True
    )
    api_client.force_authenticate(user=supervisor)

    # Payload with space formatting
    payload = {
        "phone_number": " +91 98765 43210 ",
        "name": "Sunita Devi Normalization",
        "asha_id": "AS-NORM-001",
        "village": "Bagbera",
    }

    # Register worker manually
    resp = api_client.post("/api/anm/workers/", payload, format="json")
    assert resp.status_code == 201

    # Assert database values are canonical +919876543210
    reg = WorkerRegistration.objects.get(phone="+919876543210")
    assert reg.phone == "+919876543210"

    user = User.objects.get(phone="+919876543210")
    assert user.username == "AS-NORM-001"


@pytest.mark.django_db
def test_update_worker_phone_normalization(api_client):
    """Verify editing a worker's phone number normalizes the database fields."""
    supervisor = User.objects.create_user(
        username="supervisor_update", phone="+919999988877", role=User.Role.SUPERVISOR, is_active=True
    )
    api_client.force_authenticate(user=supervisor)

    # Create registration & user manually first
    reg = WorkerRegistration.objects.create(
        phone="+919876543211", full_name="Rita Devi", supervisor=supervisor, village="Bagbera", is_active=True
    )
    worker_user = User.objects.create_user(
        username="asha_update_test", phone="+919876543211", role=User.Role.HEALTH_WORKER, first_name="Rita Devi"
    )

    # Update phone
    update_payload = {
        "phone_number": " 98765 43212 "  # Raw 10 digits with spaces
    }
    resp = api_client.patch(f"/api/anm/workers/{worker_user.pk}/", update_payload, format="json")
    assert resp.status_code == 200

    # Assert updated phone is normalized to +919876543212
    reg.refresh_from_db()
    worker_user.refresh_from_db()
    assert reg.phone == "+919876543212"
    assert worker_user.phone == "+919876543212"


def test_gps_visit_classifier():
    """Verify that GPS verification correctly classifies visit coordinates relative to household coordinates."""
    # 1. No household GPS
    res_no_gps = classify_gps_visit(28.6, 77.2, None, None, 10.0)
    assert res_no_gps["status"] == "no_household_gps"
    assert res_no_gps["distance_m"] is None

    # 2. Within acceptable radius (using settings values: acceptable=50m, warning=150m)
    # Distance is 0, effective is 0
    res_within = classify_gps_visit(28.6139, 77.2090, 28.6139, 77.2090, 10.0)
    assert res_within["status"] == "within_radius"
    assert res_within["distance_m"] == 0.0

    # 3. Outside radius
    # Distance of ~1.1km is way outside 150m
    res_outside = classify_gps_visit(28.62, 77.21, 28.61, 77.20, 5.0)
    assert res_outside["status"] == "outside_radius"


@pytest.mark.django_db
def test_sync_push_deduplication(api_client):
    """Test sync push deduplication using SyncEvent."""
    worker = User.objects.create_user(
        username="asha_sync_test", phone="+919876543000", role=User.Role.HEALTH_WORKER, is_active=True
    )
    api_client.force_authenticate(user=worker)

    # Define a single push transaction change
    event_uuid = "a1111111-2222-3333-4444-555555555555"
    payload = {
        "changes": {
            "households": {
                "created": [
                    {
                        "id": "b1111111-2222-3333-4444-555555555555",
                        "event_uuid": event_uuid,
                        "household_code": "HH-DEDUP",
                        "head_name": "Dedup Test",
                        "village": "SyncVillage",
                    }
                ],
                "updated": [],
                "deleted": [],
            }
        },
        "device_id": "test_device_1",
    }

    # 1. First push: Should be APPLIED
    resp1 = api_client.post("/api/v1/sync/push/", payload, format="json")
    assert resp1.status_code == 200
    assert resp1.data["results"][0]["status"] == "applied"

    # 2. Second push: Should be DUPLICATE
    resp2 = api_client.post("/api/v1/sync/push/", payload, format="json")
    assert resp2.status_code == 200
    assert resp2.data["results"][0]["status"] == "duplicate"


def test_telemetry_posthog(monkeypatch):
    """Verify that PostHog event tracking fails gracefully without API key and attempts dispatch when mocked."""
    from unittest.mock import MagicMock, patch

    import services.telemetry as telemetry_module
    from services.telemetry import send_posthog_event_task, track_event

    # 1. No API key configured -> should skip gracefully
    monkeypatch.setattr(telemetry_module, "POSTHOG_API_KEY", None)
    with patch("services.telemetry.send_posthog_event_task.delay") as mock_delay:
        track_event("test_user", "test_event", {"param": "val"})
        mock_delay.assert_not_called()

    # 2. API key configured -> should trigger Celery task
    monkeypatch.setattr(telemetry_module, "POSTHOG_API_KEY", "test_ph_key")
    with patch("services.telemetry.send_posthog_event_task.delay") as mock_delay:
        track_event("test_user", "test_event", {"param": "val"})
        mock_delay.assert_called_once()
        args, kwargs = mock_delay.call_args
        assert args[0] == "test_user"
        assert args[1] == "test_event"
        assert args[2] == {"param": "val"}
        assert "event_uuid" in kwargs
        assert isinstance(kwargs["event_uuid"], str)

    # 3. HTTP post test (direct execution)
    with patch("httpx.post") as mock_post:
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response
        send_posthog_event_task("test_user", "test_event", {"param": "val"}, "test_uuid_val")
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert kwargs["json"]["api_key"] == "test_ph_key"
        assert kwargs["json"]["event"] == "test_event"
        assert kwargs["json"]["uuid"] == "test_uuid_val"
        assert kwargs["json"]["properties"]["distinct_id"] == "test_user"
