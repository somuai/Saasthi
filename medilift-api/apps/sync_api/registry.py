import time

from apps.patients import models as pm

SYNC_TABLES = [
    "households",
    "patients",
    "mother_records",
    "anc_visit_records",
    "immunization_records",
    "growth_records",
    "child_development",
    "survey_responses",
    "follow_ups",
    "flags",
    "referrals",
    "incentive_records",
]

MODEL_BY_TABLE = {
    "households": pm.Household,
    "patients": pm.Patient,
    "mother_records": pm.MotherRecord,
    "anc_visit_records": pm.AncVisitRecord,
    "immunization_records": pm.ImmunizationRecord,
    "growth_records": pm.GrowthRecord,
    "child_development": pm.ChildDevelopment,
    "survey_responses": pm.SurveyResponse,
    "follow_ups": pm.FollowUp,
    "flags": pm.Flag,
    "referrals": pm.Referral,
    "incentive_records": pm.IncentiveRecord,
}

# Fields stored in payload_json for wide tables
JSON_PAYLOAD_TABLES = {
    "mother_records",
    "anc_visit_records",
    "child_development",
    "survey_responses",
}

WORKER_FIELD = {
    "households": "asha_worker_id",
    "patients": "asha_worker_server_id",
    "survey_responses": "asha_worker_server_id",
    "flags": "asha_worker_server_id",
}


def now_ms():
    return int(time.time() * 1000)


def model_to_record(obj, table):
    data = {"id": obj.id}
    for field in obj._meta.fields:
        name = field.name
        if name == "id":
            continue
        val = getattr(obj, name)
        if name == "payload_json" and table in JSON_PAYLOAD_TABLES:
            if isinstance(val, dict):
                for k, v in val.items():
                    if k != "id":
                        data[k] = v
            continue
        data[name] = val
    return data


def apply_record(model_cls, table, payload, worker_id):
    record_id = payload.get("id")
    if not record_id:
        return None
    explicit = {f.name for f in model_cls._meta.fields if f.name != "id"}
    defaults = {}
    json_payload = {}
    for key, val in payload.items():
        if key == "id":
            continue
        if key in explicit:
            defaults[key] = val
        elif table in JSON_PAYLOAD_TABLES:
            json_payload[key] = val
    if table in JSON_PAYLOAD_TABLES:
        defaults["payload_json"] = json_payload
    wf = WORKER_FIELD.get(table)
    if wf and worker_id and not defaults.get(wf):
        defaults[wf] = worker_id
    if "updated_at" not in defaults or defaults["updated_at"] is None:
        defaults["updated_at"] = now_ms()
    if "created_at" not in defaults or defaults["created_at"] is None:
        defaults["created_at"] = defaults["updated_at"]
    defaults.setdefault("is_synced", True)
    obj, _ = model_cls.objects.update_or_create(id=record_id, defaults=defaults)
    return obj


def pull_changes(since_ms, worker_id):
    changes = {t: {"created": [], "updated": [], "deleted": []} for t in SYNC_TABLES}
    for table, model_cls in MODEL_BY_TABLE.items():
        qs = model_cls.objects.filter(updated_at__gt=since_ms)
        wf = WORKER_FIELD.get(table)
        if wf and worker_id:
            qs = qs.filter(**{wf: worker_id})
        for obj in qs.iterator():
            if obj.is_deleted:
                changes[table]["deleted"].append(obj.id)
            elif obj.created_at > since_ms:
                changes[table]["created"].append(model_to_record(obj, table))
            else:
                changes[table]["updated"].append(model_to_record(obj, table))
    return changes


def push_changes(changes, worker_id):
    processed = {}
    errors = []
    for table, ops in (changes or {}).items():
        model_cls = MODEL_BY_TABLE.get(table)
        if not model_cls:
            errors.append({"table": table, "error": "unknown_table"})
            continue
        counts = {"created": 0, "updated": 0, "deleted": 0}
        for rec in ops.get("created", []):
            try:
                apply_record(model_cls, table, rec, worker_id)
                counts["created"] += 1
            except Exception as exc:  # noqa: BLE001
                errors.append({"table": table, "id": rec.get("id"), "error": str(exc)})
        for rec in ops.get("updated", []):
            try:
                apply_record(model_cls, table, rec, worker_id)
                counts["updated"] += 1
            except Exception as exc:  # noqa: BLE001
                errors.append({"table": table, "id": rec.get("id"), "error": str(exc)})
        for rec_id in ops.get("deleted", []):
            try:
                model_cls.objects.filter(id=rec_id).update(is_deleted=True, updated_at=now_ms())
                counts["deleted"] += 1
            except Exception as exc:  # noqa: BLE001
                errors.append({"table": table, "id": rec_id, "error": str(exc)})
        processed[table] = counts
    return processed, errors
