# Saasthi Production QA Checklist

Last updated: 2026-05-30

This checklist is the release gate for moving Saasthi from a release candidate to a real pilot/production deployment. It combines automated eval tiers, codebase-specific risk findings, and manual device checks that automation cannot honestly prove.

## Release Decision

Do not ship if any item in this section is open.

- [ ] `make eval-production-offline` passes on a clean release candidate branch.
- [ ] CI passes on the release branch with backend tests, mobile lint/tests, dashboard build, and migration checks.
- [ ] Backend production rehearsal passes: `python manage.py check --deploy --fail-level WARNING`.
- [ ] A real Android dev-client or release build completes login, offline writes, GPS capture, sync after reconnect, and app restart.
- [ ] `/readyz/` fails closed when DB/Redis are unavailable and is the endpoint used by container/host health checks.
- [ ] Dashboard direct routes under `/dashboard/` work after refresh.
- [ ] ANM/supervisor users cannot view, mutate, approve, pay, or report on data outside their assigned geography.
- [ ] ASHA workers cannot sync-create or sync-update patients/households outside their assigned worker/geography scope.
- [ ] OCR import degrades safely when Tesseract/Google Vision are unavailable.
- [ ] Monthly report PDFs match worker totals, incentive totals, and signature/header requirements for a sampled month.
- [ ] Sentry/logging is active in production mode and no PHI appears in client logs, server logs, or error events.
- [ ] Production secrets are set in the deployment environment, never in committed files.
- [ ] A restore rehearsal from database backup has been performed and documented.

## Automated Eval Suite

Primary commands:

```bash
# Fast static production gates only
make eval-tier6

# Full offline QA gate: mobile Jest, backend pytest, contracts, compliance,
# production-readiness static checks, dashboard build, Django deploy check.
make eval-production-offline

# Full gate with live API scenarios. Start the backend first.
make eval-production
```

Eval tiers:

| Tier | Gate | Purpose |
| --- | --- | --- |
| T1 | Mobile Jest | Offline risk, survey, auth/session, locale, sync contracts |
| T2 | Backend pytest | Django API, sync, risk, auth, incentives, GPS, data integrity |
| T3 | Contract checks | Mobile/backend payload shape drift |
| T4 | Live API scenarios | OTP, sync roundtrip, risk golden, flagging, worker scope |
| T5 | Compliance grep | Aadhaar, fetal sex, incentive coercion, OTP validation guardrails |
| T6 | Production readiness | Static deployment, security, dashboard, mobile release blockers |
| T7 | Dashboard build | TypeScript/Vite production bundle |
| T8 | Django deploy check | `manage.py check --deploy --fail-level WARNING` in prod-like env |

`eval/production_readiness.py` intentionally fails conservative checks. Fix or explicitly waive each blocker before release.

## Backend API And Data Scope

- [ ] Every API endpoint uses authentication and an explicit permission class.
- [ ] Every geography-scoped queryset uses `for_user_geography()` or an equivalent reviewed helper.
- [ ] List and detail/update/delete endpoints use the same scoping rules.
- [ ] ANM endpoints filter by the ANM's workers only.
- [ ] Admin-only endpoints cannot be reached by ANM/supervisor/ASHA roles.
- [ ] Dashboard command runner is admin-only, audited, and cannot run destructive commands from a supervisor session.
- [ ] ASHA sync push rejects direct patient writes outside the authenticated worker.
- [ ] ASHA sync push rejects direct household writes outside the authenticated worker.
- [ ] Sync upserts are idempotent for duplicated local UUIDs.
- [ ] Sync deletion handling cannot delete another worker's records.
- [ ] Foreign-key remapping is deterministic when household/patient local UUIDs arrive in the same push.
- [ ] Invalid GPS lat/lng values are rejected at serializer/API boundaries.
- [ ] `household_local_uuid` or `patient_local_uuid` not found returns a controlled 400/404, not 500.
- [ ] Bulk import updates only workers owned by the authenticated ANM/admin scope.
- [ ] Monthly report generation includes only workers visible to the requesting ANM/admin.
- [ ] High-risk patient, flag, referral, incentive, and follow-up detail endpoints have negative RBAC tests.

Recommended backend test additions:

```bash
cd backend
pytest tests/test_sync.py tests/test_worker_registration.py tests/test_dashboard_api.py -v --tb=short
```

Add or verify tests for:

- [ ] Worker A cannot update Worker B's household through sync.
- [ ] Worker A cannot update Worker B's patient through sync.
- [ ] Worker A cannot create a patient in another village/block/district.
- [ ] Supervisor A cannot view/update Supervisor B's flags, referrals, incentives, or reports.
- [ ] OTP 6th request at `5/min` returns 429 with production throttling enabled.
- [ ] Sync push/pull throttles return 429 when limits are exceeded.

## Auth, Sessions, OTP, Firebase

- [ ] Firebase phone auth succeeds on real device and backend creates/updates user claims correctly.
- [ ] Firebase service-unavailable path returns a controlled error.
- [ ] Custom OTP request/verify works for web/supervisor fallback.
- [ ] Expired OTP, wrong OTP, replayed OTP, and max attempts are rejected.
- [ ] `debug_otp` is never returned when `DJANGO_DEBUG=false` or `EXPOSE_DEBUG_OTP=false`.
- [ ] Refresh token rotation and blacklist are enabled and tested.
- [ ] Logout clears local tokens and prevents background sync.
- [ ] Offline pilot session cannot sync to server until real auth succeeds.
- [ ] Production mobile build fails fast if `EXPO_PUBLIC_API_URL` is missing.

## Mobile Offline And Sync

- [ ] App does not run in Expo Go for WatermelonDB flows; native dev client/release build is used.
- [ ] Fresh login creates local database and pulls initial config successfully.
- [ ] App restart preserves auth state and queued local writes.
- [ ] Airplane mode allows household, patient, survey, follow-up, ANC/MCP, and incentive-relevant records to be saved locally.
- [ ] Sync after reconnect pushes every local table exactly once.
- [ ] Failed push keeps records pending and displays a clear sync error.
- [ ] Token refresh is attempted before sync when access token is expired.
- [ ] `last_pulled_at` advances only after successful pull.
- [ ] Schema migrations from v1, v2, and v3 databases to current version are tested.
- [ ] Pending sync count matches actual unsynced local records.
- [ ] Background sync registers on app boot and degrades safely when OS permissions are unavailable.
- [ ] FCM token registration succeeds on physical Android.

Device smoke script:

1. Install release/dev-client build.
2. Login with Firebase OTP.
3. Turn on airplane mode.
4. Register household and patient.
5. Complete survey and follow-up.
6. Kill and reopen the app.
7. Confirm records remain pending.
8. Disable airplane mode.
9. Sync.
10. Confirm backend has one household, one patient, one survey, one follow-up, and no duplicates.

## GPS, Map, And Field Visit Verification

- [ ] Add household captures GPS when permission is granted.
- [ ] Add household works when GPS permission is denied.
- [ ] GPS status is visible to the worker in the form.
- [ ] Sync sends household latitude/longitude/accuracy.
- [ ] Follow-up visit GPS sends visit latitude/longitude/accuracy.
- [ ] Backend computes `distance_from_household_m` and `gps_verification_status` server-side.
- [ ] Map shows only the ASHA's registered households.
- [ ] Gray pins display for unsurveyed households.
- [ ] High/medium/low risk colors update after survey sync.
- [ ] Popup shows patient/household details and visit actions.
- [ ] Map falls back gracefully when remote map/API fetch fails.
- [ ] OSM tiles load without a Mapbox token.
- [ ] OSM tile usage follows provider policy; use a tile cache or paid/open tile provider before high-scale deployment.

## Clinical Safety And Public Health Workflows

- [ ] Risk golden fixtures cover low, medium, high, and hard-flag cases.
- [ ] Danger-sign symptoms always create urgent/high-risk outputs.
- [ ] High-risk pregnancy scenario creates correct flags and follow-ups.
- [ ] ANC overdue scenario appears in MCP and ANM reports.
- [ ] PNC, delivery, low-birth-weight, growth, and immunization edge cases have golden tests.
- [ ] TB symptom cluster and household cluster scenarios are covered.
- [ ] Hindi recommendations are clinically aligned with English recommendations.
- [ ] Incentive copy never encourages unsafe clinical behavior.
- [ ] Fetal sex, Aadhaar storage, and coercive incentive logic remain absent.
- [ ] Clinical rules can be deactivated without deleting historical risk snapshots.

## ANM Dashboard, Onboarding, OCR, Reports

- [ ] `/anm/workers-overview/` returns only the ANM's workers.
- [ ] Manual worker creation enforces unique ASHA ID and phone number.
- [ ] Worker invite SMS is logged/sent with the correct phone and ANM name.
- [ ] Onboarding status transitions from not contacted to SMS sent to joined.
- [ ] Resend SMS cannot target another ANM's worker.
- [ ] CSV import handles create, update, skip, duplicate phone, duplicate ASHA ID, and row-level errors.
- [ ] OCR endpoint accepts image only, enforces max size, and returns editable extracted rows.
- [ ] OCR failure returns a localized, non-500 message.
- [ ] Tesseract binaries and Hindi/English language packs exist in the production image.
- [ ] Worker detail shows profile, activity, households, recent surveys, and incentives.
- [ ] High-risk patients table is paginated, filterable, sortable, and scoped.
- [ ] Pregnancy register only includes active pregnancies in scope.
- [ ] Monthly PDF for one worker has GOI/NHM header, activity totals, incentive totals, and signature lines.
- [ ] Bulk PDF has one page/section per worker and does not mix another ANM's workers.
- [ ] Reports page downloads a valid PDF and handles empty months.

## Dashboard Web App

- [ ] `backend/dashboard` production build succeeds.
- [ ] BrowserRouter is configured for `/dashboard/` or hash routing.
- [ ] Django serves SPA fallback for direct links and refreshes.
- [ ] Static assets load with `DEBUG=false`.
- [ ] Favicon/logo references resolve.
- [ ] Login, logout, token refresh, 401 redirect, and expired-session states work.
- [ ] `/dashboard/`, `/dashboard/login`, `/dashboard/patients`, `/dashboard/reports`, and `/dashboard/map` have Playwright smoke coverage.
- [ ] Supervisor RBAC negative tests cover detail/update endpoints, not just list endpoints.
- [ ] Dashboard does not expose destructive management commands to supervisors.
- [ ] Charts and map have empty, loading, error, and degraded states.

Suggested Playwright smoke:

```bash
cd backend/dashboard
npm run build
# Then serve through Django with DEBUG=false and smoke:
# /dashboard/
# /dashboard/login
# /dashboard/patients
# /dashboard/patients?refresh
# /dashboard/map
```

## Security And Privacy

- [ ] `.env`, Firebase service accounts, signing keys, APK/AAB/IPA artifacts, and private keys are ignored.
- [ ] `DJANGO_SECRET_KEY` is unique and provided by secret manager.
- [ ] `DJANGO_ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, and CORS origins are production domains only.
- [ ] HTTPS redirect, secure cookies, HSTS, content-type nosniff, and proxy SSL header are enabled in production.
- [ ] API returns JSON only in production; browsable renderer is disabled.
- [ ] Rate limits are tested with real production values, not only test overrides.
- [ ] Logs redact phone numbers, OTPs, tokens, patient names, and free-text PHI.
- [ ] Sentry uses `send_default_pii=False`.
- [ ] Admin URL slug is not the default in production.
- [ ] Database user has least privilege.
- [ ] Backups are encrypted.
- [ ] Access to production logs and database is audited.
- [ ] Dependency audits for Python and npm are run and triaged.
- [ ] Mobile release build has no debug menus, pilot bypasses, or dev API fallback.

Suggested security commands:

```bash
cd backend && ruff check .
cd mobile && npm audit --production
cd backend/dashboard && npm audit --production
```

## Infrastructure, Docker, Celery, Static Assets

- [ ] Docker image builds from clean checkout.
- [ ] Production image includes OCR runtime packages: `tesseract-ocr`, `tesseract-ocr-hin`, `tesseract-ocr-eng`.
- [ ] `collectstatic` runs with post-processing when using manifest storage.
- [ ] Docker health check uses `/readyz/` for readiness.
- [ ] `/health/` and `/livez/` are not used as the only production readiness signal.
- [ ] Root `docker-compose.yml` has no mutable source mounts for app services.
- [ ] `api`, `celery_worker`, `celery_beat`, and `nginx` use restart policies.
- [ ] Render or host deployment defines both Celery worker and Celery beat.
- [ ] Redis is persistent or acceptable loss characteristics are documented.
- [ ] Migrations run once and do not race between multiple web instances.
- [ ] Static assets have cache headers and can be fetched after deploy.
- [ ] Media uploads have size/type checks and storage backup policy.

## Observability And Operations

- [ ] `/health/` returns status summary.
- [ ] `/livez/` confirms process liveness.
- [ ] `/readyz/` returns 503 when DB/Redis are unavailable.
- [ ] Request ID is generated, logged, and returned for support.
- [ ] Celery worker errors are visible in logs/Sentry.
- [ ] Celery beat schedule is monitored.
- [ ] API latency, 5xx rate, 4xx spike, DB connections, Redis availability, and queue depth are alerted.
- [ ] Sync error rates are tracked by client version.
- [ ] Mobile crash-free sessions are monitored.
- [ ] Deployment version is visible in health/config endpoint.
- [ ] On-call runbook includes OTP outage, Firebase outage, DB outage, Redis outage, and sync backlog procedures.

## Performance And Scale

- [ ] Sync pull remains under target latency for a worker with 200 households and realistic survey history.
- [ ] Sync push handles a full offline day of queued writes.
- [ ] ANM overview loads under target latency for 200 workers.
- [ ] Monthly bulk report generation handles 500 workers without request timeout.
- [ ] OCR image upload rejects files over max size before expensive processing.
- [ ] Database indexes exist on high-traffic fields: worker, patient, household, geography, status, timestamps.
- [ ] N+1 checks are run for dashboard overview, high-risk list, reports, and sync.
- [ ] Load test covers login, sync pull, sync push, ANM overview, and reports.

## Backup, Restore, And Data Governance

- [ ] Automated daily DB backups are enabled.
- [ ] Backup retention meets pilot policy.
- [ ] Restore has been rehearsed into a staging environment.
- [ ] Patient deletion/deactivation policy is documented.
- [ ] Role-based production access is documented.
- [ ] CSV/OCR import files are not retained longer than necessary.
- [ ] Data export for block health officer avoids unnecessary PHI.
- [ ] Audit trail exists for worker deactivation, payment approval, and report generation.

## Deployment Smoke

Run after every staging/prod deployment:

```bash
curl -i https://<host>/health/
curl -i https://<host>/livez/
curl -i https://<host>/readyz/
curl -i https://<host>/dashboard/
curl -I https://<host>/static/dashboard/index.js
```

Then manually:

1. Login as ANM/supervisor.
2. Add a test worker.
3. Resend invite.
4. Import two workers from CSV.
5. Upload OCR test image and cancel import.
6. Login as ASHA on Android.
7. Register household with GPS.
8. Complete survey.
9. Sync.
10. Confirm ANM dashboard counts update.
11. Download one monthly report PDF.
12. Deactivate test worker and confirm sessions are revoked.

## Research Sources

- Django deployment checklist: https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/
- OWASP API Security Top 10 2023: https://owasp.org/API-Security/editions/2023/en/0x11-t10/
- OWASP Mobile Application Security Verification Standard: https://mas.owasp.org/MASVS/
- Expo EAS environment variables: https://docs.expo.dev/eas/environment-variables/
- OpenStreetMap tile usage policy: https://operations.osmfoundation.org/policies/tiles/
