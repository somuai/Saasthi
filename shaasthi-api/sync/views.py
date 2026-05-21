import hashlib
import json
import logging
import time
import uuid
from datetime import datetime

from django.db import IntegrityError, transaction
from django.utils import timezone as tz
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from flagging.models import Flag
from flagging.services import dedupe_key
from followups.models import FollowUp
from incentives.models import IncentiveLedgerEntry
from mcp.models import CareInteraction
from referrals.models import Referral
from registry.models import Household, Patient
from registry.serializers import HouseholdSerializer, PatientSerializer
from risk_engine.hooks import enqueue_risk_assessment
from shaasthi_backend.querysets import for_user_geography
from shaasthi_backend.throttling import SyncPushThrottle
from surveys.models import SurveyResponse
from surveys.serializers import SurveyResponseSerializer

from .models import SyncEvent
from .serializers import SyncPushSerializer

logger = logging.getLogger(__name__)

# ── WatermelonDB table name → internal model name ───────────
TABLE_TO_MODEL = {
    "patients": "patient",
    "households": "household",
    "survey_responses": "survey_response",
    "follow_ups": "follow_up",
    "flags": "flag",
    "referrals": "referral",
    "mother_records": "care_interaction",
    "immunization_records": "care_interaction",
    "growth_records": "care_interaction",
    "incentive_records": "incentive_ledger_entry",
    "anc_visit_records": "care_interaction",
    "child_development": "care_interaction",
}

# Tables returned in pull (subset of TABLE_TO_MODEL with serializers)
PULL_TABLES = {
    "patients": PatientSerializer,
    "households": HouseholdSerializer,
    "survey_responses": SurveyResponseSerializer,
}

# ── Helpers ──────────────────────────────────────────────────


def payload_hash(change):
    raw = json.dumps(change, sort_keys=True, default=str).encode()
    return hashlib.sha256(raw).hexdigest()


def _fk_cache():
    """Build dicts mapping PK → local_uuid for every FK target model."""
    return {
        "patient": dict(Patient.objects.values_list("id", "local_uuid")),
        "household": dict(Household.objects.values_list("id", "local_uuid")),
        "flag": dict(Flag.objects.values_list("id", "local_uuid")),
    }


def _remap_fk(items, cache, mappings):
    """Replace Django integer FK values with WatermelonDB local_uuid strings."""
    for item in items:
        for django_field, wm_field in mappings:
            pk = item.pop(django_field, None)
            lookup = cache.get(django_field, {})
            if pk is not None and pk in lookup:
                item[wm_field] = str(lookup[pk])
    return items


PULL_FK_MAP = {
    "patients": [("household", "household_id")],
    "survey_responses": [("patient", "patient_id")],
    "households": [],
}

PUSH_FK_MAP = {
    "patient": {"household_id": ("household", Household)},
    "survey_response": {"patient_id": ("patient", Patient)},
    "flag": {"patient_id": ("patient", Patient)},
    "referral": {"patient_id": ("patient", Patient), "flag_id": ("flag", Flag)},
    "follow_up": {"patient_id": ("patient", Patient)},
    "care_interaction": {"patient_id": ("patient", Patient)},
}


def resolve_fk(data, model_name):
    """Replace WatermelonDB FK field names with Django model instances."""
    fk_map = PUSH_FK_MAP.get(model_name, {})
    result = data.copy()
    for wm_field, (django_field, model_class) in fk_map.items():
        val = result.pop(wm_field, None)
        if val:
            try:
                result[django_field] = model_class.objects.get(local_uuid=val)
            except model_class.DoesNotExist:
                result.pop(django_field, None)
    return result


def verify_patient_access(patient_obj, user):
    """Return True if user has geography access to this patient."""
    qs = for_user_geography(Patient.objects.filter(pk=patient_obj.pk), user)
    return qs.exists()


def geo_guard_patient(user):
    """Return a Patient queryset scoped to the user's geography."""
    return for_user_geography(Patient.objects.all(), user)


# ── Pull helpers ─────────────────────────────────────────────


def serialize_changes(queryset, serializer_class, fk_map, since=None, fk_cache=None):
    if since:
        created_qs = queryset.filter(created_at__gt=since)
        updated_qs = queryset.filter(updated_at__gt=since, created_at__lte=since)
    else:
        created_qs = queryset
        updated_qs = queryset.none()

    created = serializer_class(created_qs, many=True).data
    updated = serializer_class(updated_qs, many=True).data

    if fk_cache is not None and fk_map:
        _remap_fk(created, fk_cache, fk_map)
        _remap_fk(updated, fk_cache, fk_map)

    for item in created:
        item["id"] = item.pop("local_uuid", item.get("id"))
    for item in updated:
        item["id"] = item.pop("local_uuid", item.get("id"))

    return {"created": created, "updated": updated, "deleted": []}


# ── Upserters & Deleters ─────────────────────────────────────


def upsert_patient(local_uuid, data, user):
    defaults = {k: v for k, v in data.items()
                if k in {f.name for f in Patient._meta.fields}
                and k not in {"id", "created_at", "updated_at"}}
    obj, _ = Patient.objects.update_or_create(local_uuid=local_uuid, defaults=defaults)
    if not obj.created_by_id and user.is_authenticated:
        obj.created_by = user
        obj.save(update_fields=["created_by"])
    return obj


def delete_patient(local_uuid, user):
    qs = geo_guard_patient(user).filter(local_uuid=local_uuid)
    return qs.delete()[0] > 0


def upsert_household(local_uuid, data, user):
    defaults = {k: v for k, v in data.items()
                if k in {f.name for f in Household._meta.fields}
                and k not in {"id", "created_at", "updated_at"}}
    obj, _ = Household.objects.update_or_create(local_uuid=local_uuid, defaults=defaults)
    if not obj.created_by_id and user.is_authenticated:
        obj.created_by = user
        obj.save(update_fields=["created_by"])
    return obj


def delete_household(local_uuid, user):
    qs = Household.objects.filter(local_uuid=local_uuid)
    n = qs.update(is_active=False)
    return n > 0


def _parse_dt(value):
    """Parse a datetime from an ISO string or return the value as-is."""
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            pass
    return value


def upsert_survey_response(local_uuid, data, user):
    patient = data.get("patient")
    if not verify_patient_access(patient, user):
        raise PermissionError("No access to patient")
    defaults = {
        "patient": patient,
        "survey_type": data.get("survey_type", "pilot"),
        "answers": data.get("answers", {}),
        "score_snapshot": data.get("score_snapshot", {}),
        "synced_at": tz.now(),
    }
    submitted = data.get("submitted_at")
    if submitted:
        defaults["submitted_at"] = _parse_dt(submitted)
    obj, created = SurveyResponse.objects.update_or_create(local_uuid=local_uuid, defaults=defaults)
    if not obj.created_by_id and user.is_authenticated:
        obj.created_by = user
        obj.save(update_fields=["created_by"])
    surveyed_iso = obj.submitted_at.isoformat() if obj.submitted_at else None
    enqueue_risk_assessment(obj.patient_id, obj.id, surveyed_iso)
    return obj, created


def delete_survey_response(local_uuid, user):
    sr = SurveyResponse.objects.filter(local_uuid=local_uuid).select_related("patient").first()
    if sr and verify_patient_access(sr.patient, user):
        sr.delete()
        return True
    return False


def upsert_flag(local_uuid, data, user):
    patient = data.get("patient")
    if not verify_patient_access(patient, user):
        raise PermissionError("No access to patient")
    source = data.get("source", "sync")
    flag_type = data.get("flag_type", "clinical_risk")
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


def delete_flag(local_uuid, user):
    flag = Flag.objects.filter(local_uuid=local_uuid).select_related("patient").first()
    if flag and verify_patient_access(flag.patient, user):
        flag.delete()
        return True
    return False


def upsert_referral(local_uuid, data, user):
    patient = data.get("patient")
    if not verify_patient_access(patient, user):
        raise PermissionError("No access to patient")
    defaults = {
        "patient": patient,
        "destination": data.get("destination", ""),
        "reason": data.get("reason", ""),
        "status": data.get("status", Referral.Status.DRAFT),
        "metadata": data.get("metadata", {}),
        "created_by": user if user.is_authenticated else None,
    }
    flag_obj = data.get("flag")
    if flag_obj:
        defaults["flag"] = flag_obj
    obj, _ = Referral.objects.update_or_create(local_uuid=local_uuid, defaults=defaults)
    return obj


def delete_referral(local_uuid, user):
    ref = Referral.objects.filter(local_uuid=local_uuid).select_related("patient").first()
    if ref and verify_patient_access(ref.patient, user):
        ref.delete()
        return True
    return False


def upsert_follow_up(local_uuid, data, user):
    patient = data.get("patient")
    if not verify_patient_access(patient, user):
        raise PermissionError("No access to patient")
    defaults = {
        "patient": patient,
        "worker": user if user.is_authenticated else None,
        "scheduled_date": data.get("due_date") or data.get("scheduled_date", tz.localdate()),
        "urgency": data.get("urgency", "routine"),
        "status": data.get("status", FollowUp.Status.PENDING),
        "completion_notes": data.get("notes") or data.get("completion_notes", ""),
        "triggered_by_assessment": None,
    }
    if data.get("completed_date") or data.get("completed_at"):
        defaults["completed_at"] = data.get("completed_date") or data["completed_at"]
    obj, _ = FollowUp.objects.update_or_create(local_uuid=local_uuid, defaults=defaults)
    return obj


def delete_follow_up(local_uuid, user):
    fu = FollowUp.objects.filter(local_uuid=local_uuid).select_related("patient").first()
    if fu and verify_patient_access(fu.patient, user):
        fu.delete()
        return True
    return False


def upsert_care_interaction(local_uuid, data, user):
    patient = data.get("patient")
    if not verify_patient_access(patient, user):
        raise PermissionError("No access to patient")
    defaults = {
        "patient": patient,
        "protocol": (data.get("protocol") or data.get("vaccine_code")
                     or data.get("vaccine_name", "")),
        "notes": data.get("notes", ""),
        "payload": (data.get("payload") or data.get("milestones_json")
                    or data.get("warning_signs_json") or {}),
        "created_by": user if user.is_authenticated else None,
    }
    obj, _ = CareInteraction.objects.update_or_create(local_uuid=local_uuid, defaults=defaults)
    return obj


def delete_care_interaction(local_uuid, user):
    ci = CareInteraction.objects.filter(local_uuid=local_uuid).select_related("patient").first()
    if ci and verify_patient_access(ci.patient, user):
        ci.delete()
        return True
    return False


def upsert_incentive(local_uuid, data, user):
    defaults = {
        "worker": user if user.is_authenticated else None,
        "activity_type": data.get("activity_type") or data.get("action_type", "survey_completion"),
        "amount_paise": data.get("amount_paise") or (data.get("points", 0) * 100),
        "status": data.get("status", "pending"),
        "metadata": data.get("metadata", {}),
    }
    if data.get("month_year"):
        defaults["month_year"] = data["month_year"]
    elif data.get("period_date"):
        defaults["month_year"] = data["period_date"][:7]
    obj, _ = IncentiveLedgerEntry.objects.update_or_create(local_uuid=local_uuid, defaults=defaults)
    return obj


def delete_incentive(local_uuid, user):
    return IncentiveLedgerEntry.objects.filter(local_uuid=local_uuid).delete()[0] > 0


UPSERTS = {
    "patient": upsert_patient,
    "household": upsert_household,
    "survey_response": upsert_survey_response,
    "flag": upsert_flag,
    "referral": upsert_referral,
    "follow_up": upsert_follow_up,
    "care_interaction": upsert_care_interaction,
    "incentive_ledger_entry": upsert_incentive,
}

DELETES = {
    "patient": delete_patient,
    "household": delete_household,
    "survey_response": delete_survey_response,
    "flag": delete_flag,
    "referral": delete_referral,
    "follow_up": delete_follow_up,
    "care_interaction": delete_care_interaction,
    "incentive_ledger_entry": delete_incentive,
}


# ── Pull view ────────────────────────────────────────────────


class SyncPullView(APIView):
    def get(self, request):
        last_pulled_at = request.query_params.get("last_pulled_at")
        since = None
        if last_pulled_at and last_pulled_at != "0":
            try:
                since = datetime.fromtimestamp(int(last_pulled_at) / 1000.0)
            except (ValueError, OSError):
                since = None

        patients = geo_guard_patient(request.user).select_related("household").order_by("updated_at")
        patient_ids = list(patients.values_list("id", flat=True))
        cache = _fk_cache()

        changes = {}
        for table, serializer_cls in PULL_TABLES.items():
            if table == "patients":
                qs = patients
            elif table == "households":
                hh_ids = set(
                    Patient.objects.filter(id__in=patient_ids)
                    .values_list("household_id", flat=True)
                    .distinct()
                )
                qs = Household.objects.filter(id__in=hh_ids).order_by("updated_at")
            elif table == "survey_responses":
                qs = (
                    SurveyResponse.objects
                    .filter(patient_id__in=patient_ids)
                    .select_related("patient")
                    .order_by("updated_at")
                )
            else:
                continue
            changes[table] = serialize_changes(
                qs, serializer_cls,
                fk_map=PULL_FK_MAP.get(table, []),
                since=since,
                fk_cache=cache,
            )

        return Response({"changes": changes, "timestamp": int(time.time() * 1000)})


# ── Push view ────────────────────────────────────────────────


class SyncPushView(APIView):
    throttle_classes = [SyncPushThrottle]

    @transaction.atomic
    def post(self, request):
        device_id = request.data.get("device_id", "unknown")
        wm_changes = request.data.get("changes", {})

        logger.info("sync_push_start device_id=%s tables=%s", device_id, list(wm_changes.keys()))

        # Flatten WatermelonDB changes into a list of operations
        flat_changes = []
        for table_name, ops in wm_changes.items():
            model_name = TABLE_TO_MODEL.get(table_name)
            if not model_name:
                logger.debug("sync_push_skip_table table=%s", table_name)
                continue
            for op in ("created", "updated"):
                for record in ops.get(op, []):
                    flat_changes.append({
                        "event_uuid": record.get("event_uuid"),
                        "model": model_name,
                        "local_uuid": record.get("id"),
                        "deleted": False,
                        "data": record,
                    })
            for local_uuid in ops.get("deleted", []):
                flat_changes.append({
                    "model": model_name,
                    "local_uuid": local_uuid,
                    "deleted": True,
                    "data": {},
                })

        # Validate and deduplicate
        serializer = SyncPushSerializer(data={"changes": flat_changes, "client_id": device_id})
        serializer.is_valid(raise_exception=True)
        client_id = serializer.validated_data["client_id"]
        results = []
        survey_upserted = False

        for change in serializer.validated_data["changes"]:
            event_uuid = change.get("event_uuid")
            local_uuid = str(change["local_uuid"])

            # Deterministic dedup key when no event_uuid is provided
            dedup_uuid = event_uuid or uuid.uuid5(
                uuid.NAMESPACE_DNS,
                f"sync:{change['model']}:{local_uuid}:{'del' if change['deleted'] else 'up'}",
            )

            event_defaults = {
                "client_id": client_id,
                "event_type": "delete" if change["deleted"] else "upsert",
                "model_name": change["model"],
                "object_local_uuid": local_uuid,
                "payload_hash": payload_hash(change),
                "actor": request.user if request.user.is_authenticated else None,
            }
            if event_uuid:
                event_defaults["local_uuid"] = event_uuid

            event, event_created = SyncEvent.objects.get_or_create(
                local_uuid=dedup_uuid,
                defaults=event_defaults,
            )
            if not event_created:
                results.append({
                    "event_uuid": str(event.local_uuid),
                    "status": SyncEvent.Status.DUPLICATE,
                    "model": change["model"],
                    "local_uuid": local_uuid,
                })
                continue

            # Process the change
            try:
                if change["deleted"]:
                    delete_fn = DELETES.get(change["model"])
                    if delete_fn:
                        delete_fn(local_uuid, request.user)
                    event.status = SyncEvent.Status.APPLIED
                    event.save(update_fields=["status"])
                else:
                    # Resolve FK references before upsert
                    resolved_data = resolve_fk(change.get("data", {}), change["model"])
                    upsert_fn = UPSERTS.get(change["model"])
                    if not upsert_fn:
                        logger.warning("sync_push_no_upserter model=%s", change["model"])
                        event.status = SyncEvent.Status.ERROR
                        event.message = f"No handler for {change['model']}"
                        event.save(update_fields=["status", "message"])
                        results.append({
                            "event_uuid": str(event.local_uuid),
                            "status": event.status,
                            "model": change["model"],
                            "local_uuid": local_uuid,
                            "message": event.message,
                        })
                        continue

                    kwargs = {}
                    if change["model"] == "survey_response":
                        kwargs["survey_upserted_flag"] = True
                    result = upsert_fn(local_uuid, resolved_data, request.user)
                    if change["model"] == "survey_response":
                        survey_upserted = True
                    event.status = SyncEvent.Status.APPLIED
                    event.save(update_fields=["status"])

                results.append({
                    "event_uuid": str(event.local_uuid),
                    "status": SyncEvent.Status.APPLIED,
                    "model": change["model"],
                    "local_uuid": local_uuid,
                })

            except PermissionError as exc:
                event.status = SyncEvent.Status.ERROR
                event.message = str(exc)
                event.save(update_fields=["status", "message"])
                logger.warning("sync_push_permission_denied model=%s local_uuid=%s", change["model"], local_uuid)
                results.append({
                    "event_uuid": str(event.local_uuid),
                    "status": event.status,
                    "model": change["model"],
                    "local_uuid": local_uuid,
                    "message": event.message,
                })

            except Patient.DoesNotExist as exc:
                event.status = SyncEvent.Status.ERROR
                event.message = "Referenced patient not found"
                event.save(update_fields=["status", "message"])
                logger.warning("sync_push_patient_not_found model=%s local_uuid=%s", change["model"], local_uuid)
                results.append({
                    "event_uuid": str(event.local_uuid),
                    "status": event.status,
                    "model": change["model"],
                    "local_uuid": local_uuid,
                    "message": event.message,
                })

            except (KeyError, ValueError, TypeError) as exc:
                event.status = SyncEvent.Status.ERROR
                event.message = f"Invalid data: {exc}"
                event.save(update_fields=["status", "message"])
                logger.warning("sync_push_invalid_data model=%s local_uuid=%s error=%s", change["model"], local_uuid, exc)
                results.append({
                    "event_uuid": str(event.local_uuid),
                    "status": event.status,
                    "model": change["model"],
                    "local_uuid": local_uuid,
                    "message": event.message,
                })

            except IntegrityError:
                event.status = SyncEvent.Status.ERROR
                event.message = "Database integrity error"
                event.save(update_fields=["status", "message"])
                logger.warning("sync_push_integrity_error model=%s local_uuid=%s", change["model"], local_uuid)
                results.append({
                    "event_uuid": str(event.local_uuid),
                    "status": event.status,
                    "model": change["model"],
                    "local_uuid": local_uuid,
                    "message": event.message,
                })

            except Exception:
                logger.exception("sync_push_unexpected_error model=%s local_uuid=%s", change["model"], local_uuid)
                event.status = SyncEvent.Status.ERROR
                event.message = "Internal server error"
                event.save(update_fields=["status", "message"])
                results.append({
                    "event_uuid": str(event.local_uuid),
                    "status": event.status,
                    "model": change["model"],
                    "local_uuid": local_uuid,
                    "message": event.message,
                })
                raise  # Re-raise to roll back the transaction

        logger.info("sync_push_done device_id=%s change_count=%d survey_upserted=%s",
                     device_id, len(flat_changes), survey_upserted)

        response_payload = {"results": results, "status": "synced"}
        if survey_upserted:
            response_payload["risk_assessment"] = "processing"
        return Response(response_payload, status=status.HTTP_200_OK)
