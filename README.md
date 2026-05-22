# SHAASTHI — Digital Health Platform for India's ASHA Workers

> **Offline-first mobile platform for India's 10 lakh+ ASHA health workers.**
> Digitize household surveys, MCP Card workflows, explainable risk scoring, and supervisor dashboards — all working without internet.

![Backend Tests](https://img.shields.io/badge/backend-89%20tests%20passing-brightgreen)
![Frontend Tests](https://img.shields.io/badge/frontend-39%20tests%20passing-brightgreen)
![Eval](https://img.shields.io/badge/eval-8%2F9%20passing-yellow)
![Expo SDK](https://img.shields.io/badge/Expo-SDK%2050-000020?logo=expo)
![Django](https://img.shields.io/badge/Django-5.2-092E20?logo=django)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## Architecture

```
┌───────────────────────────────────────────────────────────┐
│                    ASHA Worker Phone                       │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Expo React Native App (WatermelonDB + Redux)       │ │
│  │                                                     │ │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────────────┐ │ │
│  │  │ Patients │  │ Surveys  │  │ Risk Scorer (27   │ │ │
│  │  │ Registry │  │ (7-step) │  │ rules, offline)   │ │ │
│  │  ├──────────┤  ├──────────┤  ├───────────────────┤ │ │
│  │  │ MCP Card │  │ Follow-  │  │ Sync Engine       │ │ │
│  │  │ (ANC/PNC │  │ ups      │  │ (WatermelonDB     │ │ │
│  │  │ /Immuniz)│  │ Calendar │  │  pull/push)       │ │ │
│  │  └──────────┘  └──────────┘  └───────────────────┘ │ │
│  └─────────────────────────────────────────────────────┘ │
└──────────────────────────┬────────────────────────────────┘
                           │ HTTPS (sync)
                           ▼
┌───────────────────────────────────────────────────────────┐
│                    Server (Docker Compose)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Django   │  │ Celery   │  │ Redis    │  │PostgreSQL│ │
│  │ REST API │  │ Workers  │  │ (broker) │  │ (16)     │ │
│  │ (DRF)    │  │          │  │          │  │          │ │
│  │ 18 apps  │  │ risk     │  │          │  │          │ │
│  │          │  │ assess   │  │          │  │          │ │
│  │          │  │ gemma-4  │  │          │  │          │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  Nginx (rate limiting, reverse proxy)               │ │
│  └──────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites
- Python 3.12+
- Node 20+
- Redis 7+ (for Celery)
- PostgreSQL 16+ (or SQLite for development)
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)

### API Server (5 minutes)

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env          # edit for your environment
python manage.py migrate
python manage.py seed_risk_rules
python manage.py runserver
```

### Mobile App (5 minutes)

```bash
cd mobile
npm install
cp .env.example .env          # set EXPO_PUBLIC_API_URL
npx expo start
```

### Docker Deployment

```bash
cd backend
cp .env.example .env          # set production values
docker compose up -d
```

---

## Production Deployment Checklist

### Environment Variables (all required in production)

| Variable | Description | Default |
|---|---|---|
| `DJANGO_SECRET_KEY` | Unique 50+ char random string | `shaasthi-dev-secret` |
| `DJANGO_DEBUG` | Must be `false` in production | `true` |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated domain names | `localhost,127.0.0.1` |
| `DATABASE_URL` | PostgreSQL connection string | `sqlite:///db.sqlite3` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |
| `CELERY_BROKER_URL` | Redis URL for Celery | `redis://localhost:6379/0` |
| `CORS_ALLOWED_ORIGINS` | Frontend origin(s) | `http://localhost:8081` |
| `SENTRY_DSN` | Sentry project DSN | *(not set)* |
| `MSG91_AUTH_KEY` | MSG91 SMS API key | *(not set)* |
| `GEMMA_API_KEY` | Google AI API key | *(not set)* |

### Production Safety (enforced at import time)

- **SECRET_KEY**: Hard crash if default when `DJANGO_DEBUG=false`
- **DEBUG**: Must be explicitly `false` in production
- **ALLOWED_HOSTS**: Hard crash if only localhost/127.0.0.1 in production
- **Sentry**: Initialized only when `SENTRY_DSN` set AND `DEBUG=false`; includes `DjangoIntegration` + `LoggingIntegration`

### Building the APK

```bash
cd mobile
# Development build (debug APK)
eas build --profile development --platform android
# Preview build (internal distribution)
eas build --profile preview --platform android
# Production build (Play Store)
eas build --profile production --platform android
```

---

## Project Structure

```
backend/                  # Django REST API
├── accounts/                  # Auth (OTP, JWT, User mgmt)
├── analytics/                 # Dashboard + CSV export
├── flagging/                  # Flag management
├── followups/                 # FollowUp + VisitRecord
├── incentives/                # Incentive ledger
├── mcp/                       # MCP Card (ANC/PNC/Growth/Immunization)
├── notifications/             # In-app + SMS notifications
├── referrals/                 # Referral tracking
├── registry/                  # Patient + Household models
├── risk_engine/               # Risk scoring + Gemma 4 AI
├── shaasthi_backend/          # Settings, URLs, Celery
├── surveys/                   # Survey response models
├── sync/                      # WatermelonDB sync
└── tests/                     # Integration + E2E tests

mobile/                  # Expo React Native
├── app/                       # Expo Router routes
│   ├── (auth)/                # Splash, Login, OTP
│   └── (tabs)/                # Home, Patients, Surveys, MCP
├── src/
│   ├── api/                   # Axios client, endpoints
│   ├── components/            # Shared UI components
│   ├── constants/             # Colors, design, feature flags
│   ├── database/              # WatermelonDB schema, sync
│   ├── features/              # Redux slices (auth, sync)
│   ├── hooks/                 # Custom hooks
│   ├── ml/                    # Offline risk scorer (27 rules)
│   ├── screens/               # Screen implementations
│   ├── services/              # Sync client
│   ├── store/                 # Redux store + AppProvider
│   └── utils/                 # Date helpers, worker ID, etc.
├── __tests__/                 # 14 test suites, 39 tests
└── assets/                    # Images, fonts

eval/                          # Automated eval harness (T1–T5)
docs/                          # Architecture, sync contract, compliance
contracts/                     # WatermelonDB pull fixture
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/otp/request/` | Request OTP (rate limited: 5/min) |
| `POST` | `/api/v1/auth/otp/verify/` | Verify OTP → JWT tokens |
| `POST` | `/api/v1/auth/token/refresh/` | Refresh JWT access token |
| `GET` | `/api/v1/config/version/` | App version check |
| `GET` | `/api/v1/config/bootstrap/` | Bootstrap config for new installs |
| `GET` | `/api/v1/config/rules/` | Risk rules config |
| `GET/POST` | `/api/v1/registry/patients/` | Patient CRUD |
| `GET/POST` | `/api/v1/registry/households/` | Household CRUD |
| `GET/POST` | `/api/v1/surveys/responses/` | Survey responses |
| `POST` | `/api/v1/risk/rules/simulate/` | Simulate a rule against historical data |
| `GET/POST` | `/api/v1/risk/assessments/` | Risk assessments |
| `GET` | `/api/v1/risk/assessments/latest/{uuid}/` | Latest assessment for patient |
| `GET` | `/api/v1/sync/pull/` | WatermelonDB pull |
| `POST` | `/api/v1/sync/push/` | WatermelonDB push |
| `GET` | `/api/v1/dashboard/summary/` | Supervisor dashboard |
| `GET` | `/api/v1/dashboard/export/flags.csv` | Flag CSV export |
| `GET` | `/api/api/docs/` | Swagger UI |
| `GET` | `/api/schema/` | OpenAPI schema |

---

## Risk Engine

The risk engine powers explainable, offline-first health risk assessment:

- **27 rules** across 5 categories: communicable, chronic, critical, maternal, general
- **10 operators**: eq, not_equals, gte, gt, lte, lt, contains, in, truthy, falsy
- **Hard flags**: Any matched hard flag immediately produces "high" risk (bypasses scoring)
- **Weighted scoring**: `score >= 8 → high`, `>= 4 → medium`, else `low`
- **Normalization**: `(total_score / max_theoretical) * 100` capped at 100
- **Bilingual output**: All recommendations in Hindi + English
- **AI enhancement**: Celery task calls Gemma 4 API for natural-language recommendations
- **Temporal rules**: Rules can be versioned and deactivated without data loss

### Scoring Flow

```
Survey → scorePatient() → rule matching (27 rules)
                        → hard flag check (short-circuit)
                        → weighted score calculation
                        → level assignment (low/medium/high)
                        → category inference
                        → recommendation selection
                        → [optional] Gemma 4 AI enhancement
                        → RiskAssessment persisted + flags created
                        → auto-schedule follow-up if high risk
```

---

## Sync Architecture (WatermelonDB)

### Offline-First Design
- 12 local tables mirror the server schema
- Every write is queued locally with `is_synced = false`
- Background sync every 15 minutes + on connectivity restore
- Pull/Push via WatermelonDB's `synchronize()` function

### Sync Flow
```
Device writes → marked as unsynced
     ↓ (on sync trigger)
Push pending → POST /api/v1/sync/push/ → deduplication via SyncEvent
     ↓
Pull changes → GET /api/v1/sync/pull/ → returns changes since last_pulled_at
     ↓
Risk assessment enqueued → Celery worker processes
     ↓
Flags + follow-ups created automatically
```

### Tables Tracked
patients, households, survey_responses, follow_ups, flags, referrals, mother_records, immunization_records, growth_records, incentive_records, anc_visit_records, child_development

---

## Security

| Layer | Mechanism |
|---|---|
| **Auth** | OTP + JWT (access 6h, refresh 30d) |
| **Rate limiting** | OTP: 5/min (DRF), API: 20r/s (nginx), Sync: 5r/s (nginx) |
| **CORS** | Restricted to `/api/` paths via `CORS_URLS_REGEX` |
| **PHI** | `PHIRedactionFilter` strips phone numbers + 14 sensitive keys from all logs |
| **Error tracking** | Sentry (production only, PII disabled) |
| **Data isolation** | Geography-scoped queries by worker region/district/block/village |
| **Audit trail** | All user/patient mutations logged via `AuditLog` |
| **App version** | Backend-enforced minimum version check; blocks outdated clients |

---

## Testing

### Backend (89 tests)
```bash
cd backend && .venv/bin/python -m pytest
```

| Suite | Tests | What it covers |
|---|---|---|
| test_e2e_pipeline | 25 | Model integrity, risk boundaries, seed idempotency, API auth, feature flags contract |
| test_gemma_integration | 10 | Mock fallback, Celery task, source field assertions |
| test_otp_auth | 1 | OTP request + verify flow |
| test_risk_and_flags | 11 | Risk assessment <-> flag integration |
| test_risk_engine_comprehensive | 31 | Hard flags, weighted scoring, temporal rules, edge cases, seed data |
| test_sync | 1 | Sync push/pull roundtrip |
| followups/tests | 10 | FollowUp + VisitRecord defaults, cascade, linking, ordering |

### Frontend (39 tests)
```bash
cd mobile && npm test
```

| Suite | Tests | What it covers |
|---|---|---|
| authSession | 5 | Token persistence, session expiry |
| ficIncentive | 4 | Incentive calculation rules |
| locale | 2 | Hindi locale formatting |
| mcpCalculators | 3 | MCP age/weight calculations |
| riskGolden | 3 | Golden path risk outputs |
| riskScorer | 5 | Rule matching, scoring |
| scorePatient | 4 | End-to-end patient scoring |
| surveyDraft | 2 | AsyncStorage draft persistence |
| surveySubmit | 3 | Survey payload building |
| syncContract | 2 | WatermelonDB sync shape |
| syncErrors | 2 | Error formatting |
| syncJitter | 1 | Sync jitter calculation |
| userInputStorage | 1 | User input persistence |
| workerId | 2 | Worker ID resolution |

### Eval Harness (T1–T5)
```bash
make eval              # Full suite (requires running API)
make eval-offline      # Offline-only tiers
make eval-tier1        # Frontend only
make eval-tier2        # Backend only
```

---

## Feature Flags

All experimental features are gated behind `FEATURES` in `mobile/src/constants/featureFlags.js`:

| Flag | Default | Description |
|---|---|---|
| `VISIT_VERIFICATION_OTP` | `false` | OTP verification on field visits |
| `OFFLINE_MAP` | `false` | Offline map support |
| `GPS_TRACKING` | `false` | GPS capture on visit records |
| `VOICE_INPUT` | `false` | Voice-to-text for survey fields |
| `PDF_PAYSLIP` | `false` | PDF payslip generation |
| `TFLITE_SCORING` | `false` | On-device TFLite model scoring |
| `GEMMA_ONDEVICE` | `false` | On-device Gemma 4 model |
| `ABDM_COMPLIANCE` | `false` | ABDM (Ayushman Bharat) compliance |

Toggle flags by changing `true`/`false` in `featureFlags.js` and rebuilding the app.

---

## Monitoring & Operations

### Production Safety Guards (settings.py)
- **SECRET_KEY**: Hard crash if default when `DJANGO_DEBUG=false`  
- **DEBUG**: Must be explicitly `false` in production  
- **ALLOWED_HOSTS**: Hard crash if only localhost/127.0.0.1 in production  
- **Sentry**: Initialized only when `SENTRY_DSN` is set AND `DEBUG=false`; captures Django errors + WARNING+ log messages  

### Logging
- Development: human-readable verbose format  
- Production: structured JSON via `JsonLogFormatter`  
- All log output passes through `PHIRedactionFilter` (strips phone numbers, Aadhaar, names)  

### Celery Workers
```bash
cd backend
celery -A shaasthi_backend worker -Q risk_assessment,celery -l info --concurrency=4
```

---

## Code Quality

```bash
# JavaScript/JSON
npm run lint              # ESLint + Prettier check
npm run format            # Prettier write

# Python
npm run lint:api           # ruff check
npm run format:api         # ruff format
```

---

## Architecture Decisions

| Decision | Rationale |
|---|---|
| **WatermelonDB** | Offline-first SQLite with sync primitives; 12 tables, no risk_assessments table (embedded in survey_responses) |
| **Dual risk scoring** | 27 frontend rules for offline speed; backend ML + Gemma 4 for server-side enhancement |
| **OTP + JWT** | Phone-based auth (ASHA workers have feature phones with SMS); JWT for stateless API access |
| **Hindi + English** | All patient-facing UI strings bilingual; ASHA workers and patients |
| **Hard flags** | Safety-critical symptoms (severe breathing, chest pain) must never be missed — hard flag bypasses all scoring |
| **No referral commissions** | `INCENTIVE_RATES` pays Rs. 0 for missed follow-ups; rewards quality actions, never referral volume |
| **Feature flags** | All experimental features default off; toggle without code change |
| **Geography scoping** | Health workers only see their assigned region/district/block/village |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Run tests: `npm run lint && make eval-offline && cd mobile && npm test`
4. Commit: `git commit -m "feat: add feature description"`
5. Push and open a PR

### Commit Convention
- `feat:` — new feature
- `fix:` — bug fix
- `refactor:` — code change without feature/bug
- `docs:` — documentation only
- `test:` — test additions/fixes
- `perf:` — performance improvement
- `sec:` — security fix

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

<p align="center">
  <strong>Built for India's frontline health workers 🇮🇳</strong><br/>
  <sub>राष्ट्रीय स्वास्थ्य मिशन | National Health Mission</sub>
</p>
