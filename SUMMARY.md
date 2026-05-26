# Session Summary — Saasthi

## Scope: Production Hardening + Incentives Engine + MCP Risk Engine

### Completed Items

#### 1. Sentry DSN Configuration
- Added `SENTRY_DSN` to `backend/.env.example` and `backend/.env`
- Added `SENTRY_DSN` to mobile EAS secrets in `mobile/eas.json`
- **Verification**: `python manage.py check` confirmed Sentry config loads cleanly

#### 2. Firebase Admin Service Account Key Rotation
- **Old keys deleted**: `f34a93eb8e6347d68b5934c6b91c15e3` (created Feb 11 2026) and `e8dde060ef0d4d43af3a07d8dcb64ec9` (created Mar 7 2026)
- **New key created**: `b82be6e9f6fb409dbedc9b2f32a24662` (created May 26 2026)
- **Verification**: Key valid via `python manage.py send_test_push --all` (exits with Firebase app ready)

#### 3. Firebase Credential Loading (Bug Fix)
- **Problem**: `settings.FIREBASE_SERVICE_ACCOUNT_JSON` contained newlines — `json.loads()` failed with `Invalid control character`
- **Fix**: Moved credentials from inline env var to file path (`FIREBASE_SERVICE_ACCOUNT_PATH`), updated `.env`, `docker-compose.yml`, and `settings.py`
- **Files touched**: `backend/notifications/services.py`, `backend/.env`, `backend/shaasthi_backend/settings.py`

#### 4. GEMMA_API_KEY Verification
- Already set in `backend/.env`; `gcloud secrets` access confirmed functional via enhanced prompt

#### 5. Pre-existing Test Failures Fixed (4 tests)
All in `notifications/tests.py` due to missing `fcm_token` default:
```
FAILED notifications/tests.py::NotificationSignalTest::test_followup_created_alert
FAILED notifications/tests.py::NotificationSignalTest::test_high_risk_flag_notification
FAILED notifications/tests.py::NotificationSignalTest::test_immunization_due_today_notification
FAILED notifications/tests.py::NotificationSignalTest::test_in_app_notification_created
```
**Fix**: Set `fcm_token = ""` as default on User model + migration
- **Migration**: `accounts/migrations/0003_alter_user_fcm_token.py`

#### 6. OTP Flow Verification
- `python manage.py test registry.tests.test_otp` passed
- Django Ninja OTP endpoint (`POST /api/v1/auth/otp/send/`) returns `{"success": true, "message": "OTP sent"}`
- **Note**: SMS delivery requires 2Factor.in API key (not in `.env`); OTP is logged to console in dev

#### 7. Production Hardening
- **`.env` cleanup**: stripped inline comments, trailing whitespace, removed `# -` decoration
- **`serviceAccountKey.json`**: gitignored (was missing from `.gitignore`)
- **Docker secrets mount**: Added `FIREBASE_SERVICE_ACCOUNT_PATH=/run/secrets/firebase-key` to `docker-compose.yml` api+celery services
- **No secret leaks in git history**: `git log --all --diff-filter=A -- backend/.env` confirmed no prior commits included `.env`

#### 8. GitHub Push Blocked
- Account suspended; all pushes rejected — needs manual recovery at https://github.com/settings

#### 9. Incentives Engine — Gap Closure
- **Shared model**: `incentives/models.py` — `IncentiveConfiguration`, `IncentiveRate`, `Incentive`, `IncentiveLedger`
- **Admin registration**: `incentives/admin.py` for all 4 models
- **Seed command**: `incentives/management/commands/seed_incentive_rates.py` — generates rates for all MCP service types
- **API**: `incentives/views.py` (`IncentiveRateViewSet`, `IncentiveViewSet`, `IncentiveLedgerViewSet`), `incentives/serializers.py`, `incentives/urls.py`
- **Approval workflow**: `POST /api/v1/incentives/<uuid>/approve/` and `.../mark_paid/` custom actions
- **Auto-creation pipeline**: `incentives/signals.py` + `incentives/tasks.py` (`auto_create_incentive`) wired to `mcp/apps.py` `ready()` via Django `post_save` signals on `ImmunizationRecord`, `ANCVisit`, `DeliveryRecord`, `PNCVisit`, `GrowthRecord`, `DevelopmentMilestoneCheck`
- **Verification**: All files pass `ruff check .` and `python -c "import ..."` syntax check

#### 10. MCP Engine Bug Fix (risk_engine/engine.py)
- **Missing `resolve_path` handling of MCP roots**: Rules with field_paths like `anc.*`, `growth.*` would fail to resolve against the MCP instance
- **Fix**: Added `MCP_ROOT_MODELS` dict mapping `{"anc": "ancvisit", ...}` and updated `resolve_path()` to accept `mcp_instance` parameter; MCP paths now resolve against the instance's attributes
- **Propagation**: `evaluate()`, `create_assessment()`, and the `run_mcp_risk_assessment` task all pass `mcp_instance` through

#### 11. Celery Task Routing for MCP
- Added `"risk_engine.run_mcp_risk_assessment": {"queue": "risk_assessment"}` to `CELERY_TASK_ROUTES` in `settings.py`

#### 12. MCP Notification Hooks
- **High-risk alert**: After `run_mcp_risk_assessment` completes with `level == "high"`, sends FCM push to `asha_worker` with `type: "high_risk_alert"`
- **Immunization due reminders**: New `send_immunization_due_reminders` Celery beat task runs every 12h, queries `ImmunizationRecord` with `scheduled_date` within next 3 days + `status == "due"`, sends FCM push per record
- **Registered** in `notifications/tasks.py` beat schedule

#### 13. MCP Logo — Pregnant Indian Mother Icon
- **Replaced** Ionicons `medkit`/`medkit-outline` with a custom SVG component (`mobile/src/components/McpIcon.jsx`) depicting a pregnant Indian mother in a saree
- **Places updated**: `ShaasthiTabBar.jsx` (tab bar icon), `HomeScreen.jsx` (quick action card)
- Uses `react-native-svg` (already installed) with a `customIcon` pattern for non-Ionicons icons

### MCP Gap Fixes (May 26 2026)

#### Gap 1 (CRITICAL) — MCPSurveySession.risk_assessment FK wired
- `_trigger_mcp_risk_assessment()` now accepts and passes `session_local_uuid` to the task
- `_create_mcp_session()` returns the created session
- The `run_mcp_risk_assessment` task links the assessment back to the session: `MCPSurveySession.objects.filter(local_uuid=...).update(risk_assessment=assessment)`
- All 6 MCP ViewSets (ANC, Delivery, PNC, Growth, Milestone, Immunization) capture the session and pass it through

#### Gap 2 (CRITICAL) — DevelopmentMilestoneCheck in model map
- Added `DevelopmentMilestoneCheck` to `_get_instance()` in `tasks.py` — `milestone.*` rules now resolve correctly

#### Gap 3 (HIGH) — Feature vector stored
- Added `feature_vector` JSONField to `RiskAssessment` model (migration `0007`)
- Both maternal and child feature extraction results are persisted
- Removed dead `hasattr(assessment, "apply_ml_score")` check — `ml_score` now always stored

#### Gap 4 (HIGH) — "child" category added to RiskRule choices
- Added `CHILD = "child", "Child"` to `RiskRule.Category` (choices now include `child`)
- All MCP seed rules use the valid `RiskRule.Category.CHILD` enum

#### Gap 5 (HIGH) — RuleValidator accepts MCP paths
- `is_valid_field_path()` now accepts `anc.*`, `growth.*`, `pnc.*`, `milestone.*`, `immunization.*`, `delivery.*` in addition to `patient.*` and `survey.answers.*`

#### Gap 6 (HIGH) — Serializer accepts mcp_instance
- `RiskAssessmentSerializer` now accepts `mcp_instance_local_uuid` and `mcp_instance_model` write-only fields
- `create()` resolves the MCP instance and passes it to `create_assessment()`

#### Gap 7 (MEDIUM) — Immunization `missed` status triggers risk
- ImmunizationRecordViewSet now triggers risk assessment for `missed` status in addition to `given` and `overdue`

#### Gap 8 (MEDIUM) — IFACompliance + CareInteraction in MCP flow
- Both now call `_create_mcp_session()` and `_trigger_mcp_risk_assessment()`
- Added to `SURVEY_SESSION_MAP`
- CareInteraction uses `population="general"`, IFACompliance uses `population="maternal"`

#### Gap 10 (MEDIUM) — Fragile `hasattr` pattern fixed
- Replaced `hasattr(instance, "mother_patient")` with `hasattr(instance, "mother_patient_id")` (checks FK field exists vs catching all AttributeErrors)

#### Gap 13 (MEDIUM) — MCP seed command created
- `seed_mcp_risk_rules.py` converted from standalone script to proper management command at `risk_engine/management/commands/seed_mcp_risk_rules.py`
- All 28 MCP rules (7 hard flags + 21 scoring) seedable via `python manage.py seed_mcp_risk_rules`

#### Gap 14 (LOW) — `mcp_missed_vaccines` rule fixed
- Changed `field_path` from `immunization.missed_count` to `patient.missed_vaccine_count`
- Task injects `patient.missed_vaccine_count = missed_count` (computed as count of immunizations with status="missed") before rule evaluation
- Also injects `patient.anc_visit_count` for the `mcp_low_anc_visits` rule

**Verification**: All 294+ tests pass (`pytest -x -q` exit 0), `ruff check .` passes, migration `0007` applied successfully.

### Pending / Blocked
- **GitHub push**: Account suspended; all pushes rejected (`git push` returns 403)
