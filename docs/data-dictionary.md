# MEDILIFT Data Dictionary

## Shared Sync Metadata

All syncable mobile/server entities include:

| Field | Purpose |
| --- | --- |
| `id` / `local_uuid` | Stable local identity for idempotent sync. |
| `server_id` | Canonical server UUID after sync. |
| `is_synced` | Mobile sync state. |
| `is_deleted` | Soft delete marker. |
| `is_mock` | Demo/test data marker. |
| `created_at`, `updated_at` | Audit and sync timestamps. |
| `asha_worker_id` | Worker attribution and RBAC scoping. |
| `device_id`, `app_version` | Sync diagnostics and device binding. |

## Core Entities

- `households`: family anchor, address, village/block/district, GPS, socioeconomic indicators, AWC/LGD.
- `patients`: beneficiary identity, demographics, privacy-limited identifiers, chronic conditions, risk state.
- `consent_records`: consent type, language, status, captured by, timestamp, revocation state.
- `mother_records`: MCP identity, LMP/EDD, JSY/PMMVY/JSSK, pregnancy outcome, birth record.
- `anc_visit_records`: MCP ANC visits 1-5 including PMSMA, vitals, investigations, danger cues.
- `pnc_visit_records`: maternal and newborn day 1/3/7/6-week checks.
- `immunization_records`: vaccine schedule, administration, missed-dose tracking, batch/ANM/site.
- `growth_records`: weight/height/MUAC, z-score or status, AWW/AWC attribution.
- `child_development_records`: age-specific milestones and warning signs.
- `eligible_couple_records`: couple registry and family-planning eligibility.
- `family_planning_records`: method counseling/provided/follow-up.
- `survey_responses`: ASHA health survey encounter and computed risk result.
- `daily_activity_records`: services, household visits, IEC, referrals, remarks.
- `disease_surveillance_records`: communicable disease flags and test/treatment status.
- `flags`: deduplicated open warnings/escalations.
- `follow_ups`: due tasks, outcomes, completion evidence.
- `referrals`: facility/provider routing and outcome tracking.
- `incentive_records`: outcome-aligned events and approval state.
- `audit_events`: actor, entity, action, timestamp, diff/metadata.
- `sync_events`: device, direction, status, counts, error details.

## Privacy Defaults

- Store Aadhaar only as last 4 digits unless a future approved integration requires otherwise.
- Analytics and provider-facing exports exclude direct PII by default.
- Consent is required before first clinical encounter submission.

