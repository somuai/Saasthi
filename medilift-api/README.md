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
- OTP: `POST /api/v1/auth/otp/request/` — returns `dev_otp` in JSON for demos.
- Verify: `POST /api/v1/auth/otp/verify/` — body `{"phone":"+919876543210","otp":"123456"}` (any 6 digits in dev).
- Sync: `GET /api/v1/sync/pull/` and `POST /api/v1/sync/push/` (JWT required) — returns Watermelon-shaped empty changes until models are wired.

Legacy backend remains in `medilift-backend/`; this package is the new v1 API tree.
