# Saasthi Backend Pilot

Django/DRF backend skeleton for the Saasthi Pilot MVP. It includes OTP auth, JWT refresh, RBAC/geography-aware APIs, registry and survey models, rule-based risk scoring, flag dedupe, sync pull/push, audit/sync event logging, config endpoints, and a small supervisor dashboard/export surface.

## Local setup

```bash
cd medilift-backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
python manage.py migrate --run-syncdb
python manage.py runserver
```

SQLite is used by default. Set `DATABASE_URL=postgres://user:password@host:5432/dbname` for Postgres.

## Tests

```bash
cd medilift-backend
pytest
```

## Public MVP endpoints

- `POST /api/v1/auth/otp/request/`
- `POST /api/v1/auth/otp/verify/`
- `POST /api/v1/auth/token/refresh/`
- `POST /api/v1/sync/pull/`
- `POST /api/v1/sync/push/`
- `GET /api/v1/config/bootstrap/`
- `GET /api/v1/config/rules/`

When `EXPOSE_DEBUG_OTP=true`, OTP request responses include `debug_otp` so local development and tests need no SMS provider. It defaults to true only when `DJANGO_DEBUG=true`.

## Pilot notes

- Every syncable record has a `local_uuid` for offline/mobile idempotency.
- Risk scoring stores an explanation trail listing matched rules.
- Flag creation dedupes by patient, flag type, source, and open status.
- Incentives are ledgered as quality/training/transport style events only; there is no referral-volume commission model.
