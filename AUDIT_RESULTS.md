# MEDILIFT build audit (May 2026)

**Last verified:** 2026-05-18 — `make eval` OVERALL PASS · `npx expo-doctor` 15/15.

## Canonical verification

```bash
make eval              # full suite (start API for T3–T4)
make eval-offline      # T1, T2, T3 offline, T5 — no server
./scripts/dev.sh       # API + migrate + mock data
```

Report: `eval/report.json`  
Coverage vs Final Build Guide: [BUILD_COVERAGE.md](BUILD_COVERAGE.md)  
Run instructions: [RUNBOOK.md](RUNBOOK.md)

## Completed

| Area | Status |
|------|--------|
| Repo-root eval suite (`eval/run.py`, scenarios, compliance, CI) | Done |
| OTP persistence + tests | Done |
| Worker-scoped sync pull/push + cross-worker push guard | Done |
| Survey: visit type, history prefill, TB heuristic, success modal, `surveySubmit.js` | Done |
| MCP: ANC visits 1–5, PMSMA, WHO growth bands, child development screen | Done |
| Follow-ups week strip | Done |
| Background sync hook (`expo-background-fetch` when installed) | Done |
| Sync screen per-table breakdown, earnings progress | Done |

## Mobile (`medilift-app`)

- Offline-first WatermelonDB + sync against `medilift-api`
- Jest: contracts, risk golden, survey submit, MCP calculators
- Reference PDFs: `medilift-app/docs/reference/`

## Backend (`medilift-api`)

- 12-table Watermelon sync, flagging engine, Celery stubs
- Postgres optional via `DATABASE_URL` in docker-compose

## Optional / deferred

- Admin dashboard (`medilift-dashboard/`)
- Full ASHA PDF field parity (all sections)
- sklearn RF training at scale
- Device E2E (Detox/Maestro)

## Demo login

`+919876543210` → request OTP → use `dev_otp` from API response.
