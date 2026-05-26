# Shaasthi — AGENTS.md

## Project Overview
Maternal/child health platform for ASHA workers in rural India. Backend Django REST API + mobile Expo React Native app.

## Tech Stack
- **Backend**: Django 5.2, DRF, Python 3.12, PostgreSQL, Redis, Celery
- **Mobile**: Expo SDK 50, React Native 0.73.6, WatermelonDB (offline-first), react-native-maps
- **Testing**: pytest (backend), Jest + @testing-library/react-native (mobile)
- **Linting**: ruff (backend, select E/F/I/N/W/UP/SIM, line-length 120), ESLint v8.57.1 + Prettier v3 (mobile)

## Commands

### Backend
```bash
ruff check .                          # lint
ruff format .                         # format
pytest                                # run tests (294+)
python manage.py makemigrations       # create DB migrations
python manage.py migrate              # apply migrations
celery -A shaasthi_backend worker -Q risk_assessment,celery -l info   # worker
celery -A shaasthi_backend beat -l info --schedule=/tmp/celerybeat-schedule
```

### Mobile
```bash
npx eslint src/                       # lint (0 errors required)
npx prettier --write src/             # format
npx expo start                        # dev server
npx expo run:android                  # native build
```

## Conventions
- All models need `__str__`, high-traffic fields need `db_index=True`
- `for_user_geography()` for all geography-scoped querysets
- `select_related()` on FK fields in ViewSets to avoid N+1
- `except: pass` is **forbidden** — use `logger.exception()` instead
- `ScopedRateThrottle` for API rate limiting; new OTP endpoints must use `scope = "otp"`
- GPS verification: `classify_gps_visit()` computes `distance_from_household_m` + `gps_verification_status` server-side during sync push
- Mobile WatermelonDB schema + model changes require a migration entry in `migrations.js`
- Sentry: DSN-controlled via env var, auto-enabled when DEBUG=false

## Production Readiness (25 May 2026)

### Security
- `.env` files now gitignored in `backend/`, `mobile/`, and root — prevents secret leaks
- `SESSION_COOKIE_SAMESITE = "Lax"`, `SESSION_COOKIE_SECURE = True`, `SESSION_COOKIE_HTTPONLY = True` — production-only via `if not DEBUG`
- JWT rotation enabled: `ROTATE_REFRESH_TOKENS = True`, `BLACKLIST_AFTER_ROTATION = True` (requires `rest_framework_simplejwt.token_blacklist` in INSTALLED_APPS)
- `DEBUG` guard: runtime-generated SECRET_KEY rejected in prod; ALLOWED_HOSTS validated against default set
- `apiBaseUrl` removed from `app.json` (was hardcoded dev IP). Production uses `EXPO_PUBLIC_API_URL` from EAS profile secrets.
- Hardcoded `"http://127.0.0.1:8000/api/v1"` fallback in `api.js` gated behind `__DEV__` — crashes with clear error in production if API_URL missing.

### Static Files
- `whitenoise` added for production static file serving (`CompressedManifestStaticFilesStorage`). `WHITENOISE_MAX_AGE = 31536000` in prod.
- `whitenoise.middleware.WhiteNoiseMiddleware` inserted after `SecurityMiddleware`.
- `STORAGES` config uses Django 5.x modern syntax.

### Infrastructure
- `docker-compose.yml`: dev `./backend:/app` mounts removed from `api`, `celery_worker`, `celery_beat`. All app services now use baked image code.
- `restart: unless-stopped` added to `api`, `celery_worker`, `celery_beat`, `nginx`.

### CI
- `ruff check . || true` → `ruff check .` (fails on lint errors)
- `npm run type-check || true` → `npm run type-check` (fails on type errors)
- `npm run lint || true` → `npm run lint` (fails on lint errors)

### Logging
- `console.log("Background message:", ...)` in `fcm.js` → `logger.debug()`
- `console.error("ErrorBoundary caught:", ...)` in `ErrorBoundary.jsx` → `logger.error()`

## Key Files
- `backend/shaasthi_backend/settings.py` — all config
- `backend/sync/views.py` — offline-sync push/pull (critical GPS wiring lives here)
- `mobile/src/database/schema.js` — WatermelonDB schema
- `mobile/src/database/migrations.js` — mobile DB migrations
- `mobile/src/constants/api.js` — API base URL resolution (env → app.json → dev fallback → crash)
