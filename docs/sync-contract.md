# Sync Contract

## Pull

`GET /api/v1/sync/pull/?last_pulled_at=<unix_seconds>`

Response:

```json
{
  "timestamp": 1779081000,
  "config_version": "pilot_config_2026_05",
  "rules_version": "rules_v2_mcp_2026",
  "changes": {
    "patients": {
      "created": [],
      "updated": [],
      "deleted": []
    }
  }
}
```

## Push

`POST /api/v1/sync/push/`

Request:

```json
{
  "device_id": "android-asha-001",
  "app_version": "0.1.0",
  "last_pulled_at": 1779080000,
  "changes": {
    "survey_responses": {
      "created": [
        {
          "id": "local-survey-001",
          "local_uuid": "local-survey-001",
          "patient_id": "local-patient-001",
          "survey_date": "2026-05-18",
          "computed_risk_score": 82,
          "computed_risk_level": "critical"
        }
      ],
      "updated": [],
      "deleted": []
    }
  }
}
```

Response:

```json
{
  "timestamp": 1779081050,
  "processed": {
    "survey_responses": {"created": 1, "updated": 0, "deleted": 0}
  },
  "receipts": [
    {"table": "survey_responses", "local_uuid": "local-survey-001", "server_id": "1f83..."}
  ],
  "errors": []
}
```

## Idempotency

- `local_uuid` is unique per table and worker scope.
- Re-sending the same `created` record updates missing sync metadata but does not duplicate clinical events.
- Failed records return table, local UUID, reason, and retryability.

