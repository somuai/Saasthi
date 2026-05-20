import hashlib
import json
import logging

from django.db import transaction
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from flagging.models import Flag
from flagging.services import dedupe_key
from risk_engine.hooks import enqueue_risk_assessment
from shaasthi_backend.querysets import for_user_geography
from shaasthi_backend.throttling import SyncPushThrottle
from referrals.models import Referral
from registry.models import Patient
from registry.serializers import PatientSerializer
from surveys.models import SurveyResponse
from surveys.serializers import SurveyResponseSerializer

from .models import SyncEvent
from .serializers import SyncPullSerializer, SyncPushSerializer

logger = logging.getLogger(__name__)


def payload_hash(change):
    raw = json.dumps(change, sort_keys=True, default=str).encode()
    return hashlib.sha256(raw).hexdigest()


def serialize_model(queryset, serializer_class, since=None):
    if since:
        queryset = queryset.filter(updated_at__gt=since)
    return serializer_class(queryset, many=True).data


def upsert_patient(local_uuid, data, user):
    payload = data.copy()
    payload["local_uuid"] = local_uuid
    obj, _ = Patient.objects.update_or_create(
        local_uuid=local_uuid,
        defaults={
            k: v
            for k, v in payload.items()
            if k in {field.name for field in Patient._meta.fields} and k not in {"id", "created_at", "updated_at"}
        },
    )
    if not obj.created_by_id and user.is_authenticated:
        obj.created_by = user
        obj.save(update_fields=["created_by"])
    return obj


def upsert_survey_response(local_uuid, data, user):
    patient = Patient.objects.get(local_uuid=data["patient_local_uuid"])
    defaults = {
        "patient": patient,
        "survey_type": data.get("survey_type", "pilot"),
        "answers": data.get("answers", {}),
        "score_snapshot": data.get("score_snapshot", {}),
    }
    if data.get("submitted_at"):
        defaults["submitted_at"] = data["submitted_at"]
    obj, created = SurveyResponse.objects.update_or_create(local_uuid=local_uuid, defaults=defaults)
    if not obj.created_by_id and user.is_authenticated:
        obj.created_by = user
        obj.save(update_fields=["created_by"])
    surveyed_at = obj.submitted_at.isoformat() if obj.submitted_at else None
    enqueue_risk_assessment(obj.patient_id, obj.id, surveyed_at)
    return obj, created


def upsert_flag(local_uuid, data, user):
    patient = Patient.objects.get(local_uuid=data["patient_local_uuid"])
    source = data.get("source", "sync")
    flag_type = data["flag_type"]
    defaults = {
        "local_uuid": local_uuid,
        "patient": patient,
        "flag_type": flag_type,
        "source": source,
        "severity": data.get("severity", "medium"),
        "status": data.get("status", Flag.Status.OPEN),
        "score": data.get("score", 0),
        "explanation": data.get("explanation", {}),
        "created_by": user if user.is_authenticated else None,
    }
    key = data.get("dedupe_key") or dedupe_key(patient, flag_type, source)
    flag, _ = Flag.objects.update_or_create(dedupe_key=key, defaults=defaults)
    return flag


def upsert_referral(local_uuid, data, user):
    patient = Patient.objects.get(local_uuid=data["patient_local_uuid"])
    defaults = {
        "patient": patient,
        "destination": data.get("destination", ""),
        "reason": data.get("reason", ""),
        "status": data.get("status", Referral.Status.DRAFT),
        "metadata": data.get("metadata", {}),
        "created_by": user if user.is_authenticated else None,
    }
    if data.get("flag_local_uuid"):
        defaults["flag"] = Flag.objects.get(local_uuid=data["flag_local_uuid"])
    obj, _ = Referral.objects.update_or_create(local_uuid=local_uuid, defaults=defaults)
    return obj


UPSERTS = {
    "patient": upsert_patient,
    "survey_response": upsert_survey_response,
    "flag": upsert_flag,
    "referral": upsert_referral,
}


class SyncPullView(APIView):
    def get(self, request):
        last_pulled_at = request.query_params.get("last_pulled_at")
        since = None
        if last_pulled_at and last_pulled_at != "0":
            from datetime import datetime

            since = datetime.fromtimestamp(int(last_pulled_at) / 1000.0)

        patients = for_user_geography(Patient.objects.all().order_by("updated_at"), request.user)
        patient_ids = patients.values("id")

        def to_wm(qs, serializer_class):
            data = serialize_model(qs, serializer_class, since)
            for item in data:
                item["id"] = item.pop("local_uuid", item.get("id"))
            return {"created": data, "updated": [], "deleted": []}

        changes = {
            "patients": to_wm(patients, PatientSerializer),
            "survey_responses": to_wm(
                SurveyResponse.objects.filter(patient_id__in=patient_ids).order_by("updated_at"),
                SurveyResponseSerializer,
            ),
        }

        import time

        return Response({"changes": changes, "timestamp": int(time.time() * 1000)})


class SyncPushView(APIView):
    throttle_classes = [SyncPushThrottle]

    @transaction.atomic
    def post(self, request):
        device_id = request.data.get("device_id", "unknown")
        wm_changes = request.data.get("changes", {})

        logger.info(
            "sync_push_start device_id=%s tables=%s",
            device_id,
            list(wm_changes.keys()),
        )

        flat_changes = []
        table_to_model = {
            "patients": "patient",
            "survey_responses": "survey_response",
            "flags": "flag",
            "referrals": "referral",
        }

        for table_name, ops in wm_changes.items():
            model_name = table_to_model.get(table_name)
            if not model_name:
                continue
            for op in ["created", "updated"]:
                for record in ops.get(op, []):
                    if "patient_id" in record:
                        record["patient_local_uuid"] = record["patient_id"]
                    flat_changes.append(
                        {
                            "event_uuid": record.get("event_uuid"),
                            "model": model_name,
                            "local_uuid": record.get("id"),
                            "deleted": False,
                            "data": record,
                        }
                    )
            for local_uuid in ops.get("deleted", []):
                flat_changes.append({"model": model_name, "local_uuid": local_uuid, "deleted": True})

        serializer = SyncPushSerializer(data={"client_id": device_id, "changes": flat_changes})
        serializer.is_valid(raise_exception=True)
        client_id = serializer.validated_data["client_id"]
        results = []
        survey_upserted = False

        for change in serializer.validated_data["changes"]:
            event_uuid = change.get("event_uuid")
            if event_uuid and SyncEvent.objects.filter(local_uuid=event_uuid).exists():
                event = SyncEvent.objects.get(local_uuid=event_uuid)
                results.append(
                    {
                        "event_uuid": str(event.local_uuid),
                        "status": SyncEvent.Status.DUPLICATE,
                        "model": change["model"],
                        "local_uuid": str(change["local_uuid"]),
                    }
                )
                continue
            event_payload = {
                "client_id": client_id,
                "event_type": "delete" if change.get("deleted") else "upsert",
                "model_name": change["model"],
                "object_local_uuid": str(change["local_uuid"]),
                "payload_hash": payload_hash(change),
                "actor": request.user if request.user.is_authenticated else None,
            }
            if event_uuid:
                event_payload["local_uuid"] = event_uuid
            event = SyncEvent.objects.create(**event_payload)
            try:
                upsert_fn = UPSERTS[change["model"]]
                if change["model"] == "survey_response":
                    obj, _created = upsert_fn(change["local_uuid"], change.get("data", {}), request.user)
                    survey_upserted = True
                else:
                    obj = upsert_fn(change["local_uuid"], change.get("data", {}), request.user)
                results.append(
                    {
                        "event_uuid": str(event.local_uuid),
                        "status": event.status,
                        "model": change["model"],
                        "local_uuid": str(getattr(obj, "local_uuid", change["local_uuid"])),
                    }
                )
            except Exception as exc:
                event.status = SyncEvent.Status.ERROR
                event.message = str(exc)
                event.save(update_fields=["status", "message"])
                logger.warning(
                    "sync_push_row_error model=%s local_uuid=%s error=%s",
                    change["model"],
                    change["local_uuid"],
                    exc,
                )
                results.append(
                    {
                        "event_uuid": str(event.local_uuid),
                        "status": event.status,
                        "model": change["model"],
                        "local_uuid": str(change["local_uuid"]),
                        "message": event.message,
                    }
                )

        logger.info(
            "sync_push_done device_id=%s change_count=%d survey_upserted=%s",
            device_id,
            len(flat_changes),
            survey_upserted,
        )

        response_payload = {"results": results, "status": "synced"}
        if survey_upserted:
            response_payload["risk_assessment"] = "processing"
        return Response(response_payload, status=status.HTTP_200_OK)
