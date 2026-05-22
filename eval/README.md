# SHAASTHI eval suite

Reproducible checks for mobile units, API integration, contracts, live scenarios, and compliance.

## Quick start

```bash
# Offline (no API server): T1, T2, T3 offline, T5
make eval-offline

# Full (start API first)
cd backend && source .venv/bin/activate && python manage.py runserver
# another terminal:
make eval
```

## Tiers

| Tier | What |
|------|------|
| T1 | `mobile` Jest (risk golden, survey submit, contracts) |
| T2 | `backend` Django tests |
| T3 | Contract shape vs `contracts/*.json` (live pull optional) |
| T4 | Live HTTP scenarios (`eval/scenarios/*.py`) |
| T5 | Static compliance grep checks |

## Debug a failure

```bash
python3 eval/run.py --tier 2 --verbose
open eval/report.json
```

## Environment

- `SHAASTHI_API_URL` — default `http://127.0.0.1:8000`
- `pip install -r eval/requirements.txt` for T4

## Risk scoring contract (server vs mobile)

- **Server (Django):** `backend/risk_engine/` — weighted rules, hard flags → `normalized_score=100`, levels `low` / `medium` / `high` from raw score thresholds (4 and 8).
- **Mobile (offline):** `mobile/src/ml/riskScorer.js` — keep aligned on level thresholds and critical symptoms over time; server assessments are authoritative after sync.

## Manual smoke (not in CI)

- `cd mobile && npm start` — login `+919876543210`, OTP from API `dev_otp`
- Background sync: registered on app boot via `initAutoSync()`; optional `expo-background-fetch` when installed
