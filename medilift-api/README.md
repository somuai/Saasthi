# MEDILIFT API (Prompt 10 skeleton)

Python 3.9+.

```bash
cd medilift-api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements/dev.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

- API base: `http://127.0.0.1:8000/api/v1/`
- OTP request: `POST /api/v1/auth/otp/request/` — returns `dev_otp` in JSON (development only).
- OTP verify: `POST /api/v1/auth/otp/verify/` — body `{"phone":"+919876543210","otp":"<from dev_otp>"}`. Invalid or expired OTP returns **400**.
- Sync: `GET /api/v1/sync/pull/` and `POST /api/v1/sync/push/` (JWT required). Pull/push are scoped to the authenticated ASHA worker.

## Tests

```bash
python manage.py test tests
```

## Eval suite

From repo root: `make eval` (see [eval/README.md](../eval/README.md)).

Legacy backend remains in `medilift-backend/`; this package is the v1 sync API.
