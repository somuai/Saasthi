# SHAASTHI eval suite

Reproducible checks for mobile units, API integration, contracts, live scenarios, and compliance.

## Quick start

```bash
# Offline (no API server): T1, T2, T3 offline, T5
make eval-offline

# Full (start API first)
cd shaasthi-api && source .venv/bin/activate && python manage.py runserver
# another terminal:
make eval
```

## Tiers

| Tier | What |
|------|------|
| T1 | `shaasthi-app` Jest (risk golden, survey submit, contracts) |
| T2 | `shaasthi-api` Django tests |
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

## Manual smoke (not in CI)

- `cd shaasthi-app && npm start` — login `+919876543210`, OTP from API `dev_otp`
- Background sync: registered on app boot via `initAutoSync()`; optional `expo-background-fetch` when installed
