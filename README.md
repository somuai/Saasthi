# SHAASTHI — Digital Health Platform for India's ASHA Workers

[![CI](https://github.com/Luciferai04/Saasthi/actions/workflows/eval.yml/badge.svg)](https://github.com/Luciferai04/Saasthi/actions/workflows/eval.yml)
[![Backend Tests](https://img.shields.io/badge/tests-281%20passing-brightgreen)](https://github.com/Luciferai04/Saasthi/actions)
[![Frontend Tests](https://img.shields.io/badge/tests-37%20passing-brightgreen)](https://github.com/Luciferai04/Saasthi/actions)
[![Expo SDK](https://img.shields.io/badge/Expo-52-000020?logo=expo)](https://expo.dev)
[![Django](https://img.shields.io/badge/Django-5.2-092E20?logo=django)](https://djangoproject.com)
[![Python](https://img.shields.io/badge/python-3.12%2B-3776AB?logo=python)](https://python.org)
[![License](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**Offline-first mobile platform purpose-built for India's 1M+ ASHA health workers.** Digitises household surveys, MCP Card workflows, explainable risk scoring, supervisor dashboards, and incentive management — all functioning without internet connectivity.

---

## Why SHAASTHI?

India's ASHA (Accredited Social Health Activist) workers serve as the frontline of rural healthcare, yet most rely on paper registers and SMS-based reporting. SHAASTHI replaces paper MCP cards with an offline-capable mobile application, enabling:

- **Offline-first operation** — full functionality in areas with no connectivity; syncs when online
- **Explainable risk scoring** — 27-rule clinical engine with hard-flag safety checks, bilingual recommendations (Hindi/English)
- **Accountability** — GPS-tagged field visits with OTP verification ensures supervisors can verify doorstep service delivery
- **Scalable** — single Django backend supports thousands of concurrent ASHA workers per deployment

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      ASHA Worker Device                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Expo React Native App (WatermelonDB + Redux Toolkit)      │ │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ │ │
│  │  │ Patients │ │ Surveys  │ │ Risk     │ │ MCP Card     │ │ │
│  │  │ Registry │ │ (7-step) │ │ Scorer   │ │ (ANC/PNC/    │ │ │
│  │  │          │ │          │ │ (27      │ │  Immuniz.)   │ │ │
│  │  │          │ │          │ │  rules)  │ │              │ │ │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────────┘ │ │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────────────────────┐ │ │
│  │  │Follow-ups│ │ Voice    │ │ TFLite Scoring / AI Chat   │ │ │
│  │  │ Calendar │ │ Input    │ │ (on-device ML inference)   │ │ │
│  │  └──────────┘ └──────────┘ └────────────────────────────┘ │ │
│  └──────────────────────────┬─────────────────────────────────┘ │
│                             │ HTTPS (WatermelonDB sync)         │
└─────────────────────────────┼───────────────────────────────────┘
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      Server (Docker Compose)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐ │
│  │ Django   │ │ Celery   │ │ Redis    │ │ PostgreSQL 16      │ │
│  │ REST API │ │ Workers  │ │ (broker) │ │                    │ │
│  │ (DRF)    │ │          │ │          │ │                    │ │
│  │ 18 apps  │ │ Risk     │ │          │ │                    │ │
│  │          │ │ Assess / │ │          │ │                    │ │
│  │          │ │ Gemma AI │ │          │ │                    │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Nginx (rate limiting, reverse proxy, TLS termination)    │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

**Key design properties:**
- **Mobile**: React Native / Expo SDK 52, WatermelonDB for local persistence, Redux Toolkit for state
- **API**: Django 5.2 + DRF, JWT auth (OTP-based), Celery for async tasks, Sentry for error tracking
- **Data**: PostgreSQL (production), SQLite (dev), geography-scoped queries for data isolation

---

## Quick Start

### Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Python | 3.12+ | Backend runtime |
| Node.js | 20+ | Mobile toolchain |
| Redis | 7+ | Celery broker |
| PostgreSQL | 16+ | Production database |
| Expo CLI | Latest | Mobile development |
| EAS CLI | Latest | APK builds |

### API Server

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env          # configure DATABASE_URL, SECRET_KEY, etc.
python manage.py migrate
python manage.py seed_risk_rules
python manage.py runserver
```

### Mobile App

```bash
cd mobile
npm install
cp .env.example .env          # set EXPO_PUBLIC_API_URL
npx expo start
# Scan QR code with Expo Go, or press 'a' for Android emulator
```

### Docker (Production)

```bash
cd backend
cp .env.example .env
docker compose up -d
```

---

## Feature Overview

### Core Modules

| Module | Description | Status |
|---|---|---|
| **Patient Registry** | Household registration, patient profiles, demographics | ✅ Complete |
| **Survey Engine** | 7-step health survey with offline scoring | ✅ Complete |
| **Risk Assessment** | 27-rule explainable risk engine + hard-flag safety checks | ✅ Complete |
| **MCP Card** | ANC/PNC schedules, growth tracking, immunisation calendar | ✅ Complete |
| **Sync Engine** | WatermelonDB pull/push with conflict resolution | ✅ Complete |
| **Follow-up Calendar** | GPS-tagged visits, OTP-verified doorstep confirmation | ✅ Complete |
| **Incentive Ledger** | Auto-calculated ASHA worker incentives + PDF payslips | ✅ Complete |
| **Supervisor Dashboard** | Aggregate analytics, flag CSV export | ✅ Complete |
| **Push Notifications** | FCM-based daily reminders, follow-up alerts | ✅ Complete |

### Advanced Features (Feature-Flagged)

| Feature | Flag | Description |
|---|---|---|
| **GPS Visit Verification** | `GPS_TRACKING` | Capture lat/lng on field visits with Haversine distance validation |
| **Visit OTP** | `VISIT_VERIFICATION_OTP` | 4-digit OTP (bcrypt hashed, 15-min expiry, 3 attempts) for doorstep verification |
| **Voice Input** | `VOICE_INPUT` | Hindi/English speech-to-text for survey notes via `@react-native-voice/voice` |
| **PDF Payslip** | `PDF_PAYSLIP` | Reportlab-generated payslips with share-sheet download |
| **Push Notifications** | `PUSH_NOTIFICATIONS` | Firebase Cloud Messaging for daily reminders + follow-up alerts |
| **ANM Bulk Import** | — | CSV-based worker registration (supervisor/admin only) |
| **Multi-Language** | — | Hindi, English, Bengali, Telugu, Kannada |
| **Historical Backfill** | — | CSV import for paper MCP card data |
| **Offline Map** | `OFFLINE_MAP` | `react-native-maps` with gender-coded patient markers |
| **TFLite Scoring** | `TFLITE_SCORING` | On-device 20-rule scorer with `weights.json` fallback |
| **AI Assistant** | `GEMMA_ONDEVICE` | Gemma-powered bilingual health Q&A chat |
| **ABDM/FHIR** | `ABDM_COMPLIANCE` | ABHA number fields, FHIR R4 Patient bundle builder |

---

## API Reference

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/otp/request/` | Request OTP (rate-limited: 5/min per phone) |
| `POST` | `/api/v1/auth/otp/verify/` | Verify OTP → JWT access + refresh tokens |
| `POST` | `/api/v1/auth/token/refresh/` | Refresh expired access token |
| `POST` | `/api/v1/auth/users/fcm-token/` | Register FCM push token |
| `POST` | `/api/v1/auth/workers/bulk-import/` | CSV import of worker registrations |

### Core Resources

| Method | Endpoint | Description |
|---|---|---|
| `GET/POST` | `/api/v1/registry/patients/` | Patient CRUD |
| `GET/POST` | `/api/v1/registry/households/` | Household CRUD |
| `PATCH` | `/api/v1/registry/patients/{id}/location/` | Household GPS coordinates |
| `GET` | `/api/v1/registry/patients/{id}/fhir/` | FHIR R4 Patient resource |
| `GET` | `/api/v1/registry/patients/map_data/` | GeoJSON patient data for map |
| `GET/POST` | `/api/v1/surveys/responses/` | Survey responses |
| `GET/POST` | `/api/v1/followups/visits/` | Tracked field visits |
| `POST` | `/api/v1/followups/visits/{id}/request-otp/` | Request visit verification OTP |
| `POST` | `/api/v1/followups/visits/{id}/verify-otp/` | Verify visit OTP |

### Risk Engine

| Method | Endpoint | Description |
|---|---|---|
| `GET/POST` | `/api/v1/risk/assessments/` | Risk assessments |
| `GET` | `/api/v1/risk/assessments/latest/{uuid}/` | Latest assessment by patient |
| `POST` | `/api/v1/risk/assessments/gemma_query/` | AI-powered health Q&A (rate-limited: 10/min) |
| `POST` | `/api/v1/risk/rules/simulate/` | Simulate rule against historical data |

### Sync & Config

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/sync/pull/` | WatermelonDB pull (geography-scoped) |
| `POST` | `/api/v1/sync/push/` | WatermelonDB push (atomic batch) |
| `GET` | `/api/v1/config/version/` | App version check |
| `GET` | `/api/v1/config/bootstrap/` | Bootstrap config for new installs |
| `GET` | `/api/v1/config/rules/` | Risk rules configuration |
| `GET` | `/api/v1/health/` | Health check (DB + Celery ping) |

### Dashboard & Admin

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/dashboard/summary/` | Supervisor aggregate dashboard |
| `GET` | `/api/v1/dashboard/export/flags.csv` | Flag CSV export |
| `GET` | `/api/v1/incentives/earnings/` | Worker incentive ledger |
| `GET` | `/api/v1/incentives/payslip/{id}/` | PDF payslip download |

### API Documentation

| Endpoint | Description |
|---|---|
| `/api/api/docs/` | Swagger UI (drf-spectacular) |
| `/api/schema/` | OpenAPI 3.0 schema |

---

## Project Structure

```
.
├── backend/                          # Django REST API
│   ├── accounts/                     # Auth, OTP, JWT, user management
│   ├── analytics/                    # Dashboard views, CSV exports
│   ├── flagging/                     # Automated flag creation
│   ├── followups/                    # Visit records, OTP verification, GPS
│   ├── incentives/                   # ASHA incentive ledger, PDF payslips
│   ├── mcp/                          # MCP Card (ANC/PNC/Growth/Immunisation)
│   ├── notifications/               # FCM push + SMS notifications
│   ├── referrals/                    # PHC referral tracking
│   ├── registry/                     # Patient + Household models, FHIR API
│   ├── risk_engine/                  # Risk scoring, Gemma AI integration
│   ├── shaasthi_backend/             # Settings, Celery, health check
│   ├── surveys/                      # Survey response models
│   ├── sync/                         # WatermelonDB pull/push sync
│   └── tests/                        # 281 integration + unit tests
│
├── mobile/                           # Expo React Native App
│   ├── app/                          # Expo Router routes
│   │   ├── (auth)/                   # Splash, Login, OTP screens
│   │   └── (tabs)/                   # Home, Patients, Surveys, MCP, Map, AI
│   ├── src/
│   │   ├── api/                      # Axios client, endpoint definitions
│   │   ├── components/               # Shared UI (OtpInput, VoiceButton, TabBar)
│   │   ├── constants/                # Colours, design tokens, feature flags, i18n
│   │   ├── database/                 # WatermelonDB schema, sync client
│   │   ├── hooks/                    # useSpeechInput, custom hooks
│   │   ├── ml/                       # Risk scorer, TFLite service, risk engine
│   │   ├── screens/                  # Full-screen views (tabs + modals)
│   │   ├── services/                 # FCM, sync, network status
│   │   └── utils/                    # Locale, date helpers, jitter, worker ID
│   ├── __tests__/                    # 14 suites, 37 Jest tests
│   └── assets/                       # Images, fonts, ML weights
│
├── eval/                             # Automated evaluation harness (T1–T5)
├── contracts/                        # WatermelonDB sync contract fixtures
└── docs/                             # Architecture, sync contract, runbook
```

---

## Risk Engine

The risk assessment engine is the clinical core of the platform, designed for explainability and offline operation.

### Rules (27 total)

| Category | Rules | Examples |
|---|---|---|
| **Communicable** | 4 | Active TB, recurring fever, chronic cough |
| **Chronic** | 7 | Hypertension, diabetes, anaemia severity |
| **Critical** | 4 | Severe breathing difficulty, chest pain, unconsciousness |
| **Maternal** | 8 | High-risk pregnancy, previous C-section, anaemia in ANC |
| **General** | 4 | Age >60, underweight, disability |

### Scoring Flow

```
Survey submission → scorePatient() → rule matching (27 clinical rules)
                                   → hard-flag check (short-circuits to HIGH)
                                   → weighted score calculation (0–100)
                                   → level assignment: LOW (≤25) / MEDIUM (≤50) / HIGH (≤75) / CRITICAL (>75)
                                   → category inference → recommendation selection
                                   → [optional] Gemma AI natural-language enhancement
                                   → RiskAssessment persisted + Flag created
                                   → Auto-schedule follow-up if HIGH/CRITICAL
```

### Dual Scoring Modes

| Mode | Location | Latency | Model |
|---|---|---|---|
| **On-device (rule-based)** | `mobile/src/ml/riskScorer.js` | Instant | 27 rules, JavaScript |
| **On-device (TFLite)** | `mobile/src/ml/TFLiteService.js` | Instant | 20 rules + `weights.json` |
| **Server-side** | `backend/risk_engine/` | ~100ms | Full rules + Gemma AI |

---

## Offline Sync (WatermelonDB)

The sync architecture follows WatermelonDB's pull/push protocol:

```
Device write → local SQLite (is_synced=false)
     ↓ (trigger: 15-min interval / connectivity restore)
Push pending changes → POST /api/v1/sync/push/ → atomic batch apply
     ↓
Pull server changes → GET /api/v1/sync/pull/?last_pulled_at=<ts>
     ↓
Risk assessment enqueued → Celery async processing
     ↓
Flags + follow-ups created automatically
```

**12 synced tables:** patients, households, survey_responses, follow_ups, flags, referrals, mother_records, immunisation_records, growth_records, incentive_records, anc_visit_records, child_development

---

## Testing

### Backend (281 tests)

```bash
cd backend && python -m pytest
```

| Suite | Count | Coverage |
|---|---|---|
| `test_e2e_pipeline` | 25 | Model integrity, risk boundaries, seed idempotency, API auth |
| `test_gemma_integration` | 10 | Mock fallback, Celery task, source field assertions |
| `test_otp_auth` | 1 | OTP request + verify flow |
| `test_risk_and_flags` | 11 | Risk-to-flag integration |
| `test_risk_engine_comprehensive` | 31 | Hard flags, weighted scoring, edge cases |
| `test_sync` | 1 | Sync push/pull roundtrip |
| `followups/tests` | 10 | FollowUp + VisitRecord defaults, cascade |
| `test_new_endpoints` | 16 | FCM, map_data, FHIR, bulk_import, gemma_query |
| `test_visit_otp` | 4 | OTP generation, verification, bypass |
| `test_worker_registration` | 4 | CSV import, validation |
| `unit/test_risk_engine` | 36 | Comparison operators, risk level mapping |
| `unit/test_mcp_risk_engine` | 83 | MCP clinical hard flags, immunisation rules, feature extraction |
| `unit/test_feature_extractor` | 5 | MCP feature extraction |
| `unit/test_otp_service` | 44 | OTP hash, expiry, validation |

### Frontend (37 tests)

```bash
cd mobile && npx jest
```

| Suite | Count | Coverage |
|---|---|---|
| authSession | 5 | Token persistence, session expiry |
| ficIncentive | 4 | Incentive calculation rules |
| locale | 2 | Hindi locale formatting |
| mcpCalculators | 3 | MCP age/weight calculations |
| riskGolden | 3 | Golden path risk outputs |
| riskScorer | 5 | Rule matching, scoring edge cases |
| scorePatient | 4 | End-to-end patient scoring |
| surveyDraft | 2 | AsyncStorage draft persistence |
| surveySubmit | 3 | Survey payload building |
| syncContract | 2 | WatermelonDB sync shape |
| syncErrors | 2 | Error formatting |
| syncJitter | 1 | Sync jitter calculation |
| userInputStorage | 1 | User input persistence |
| workerId | 2 | Worker ID resolution |

### Evaluation Harness (T1–T5)

```bash
make eval              # Full suite (requires running API on :8000)
make eval-offline      # Offline-only tiers (contract, unit tests)
make eval-tier1        # Mobile unit tests only
make eval-tier2        # Backend unit tests only
```

---

## Security

| Layer | Mechanism |
|---|---|
| **Authentication** | OTP + JWT (access: 6h, refresh: 30d) |
| **Rate Limiting** | OTP: 5/min, Risk assessment: 30/min, Gemma query: 10/min, Sync push: scoped |
| **PHI Protection** | `PHIRedactionFilter` strips phone numbers + 14 sensitive fields from all logs |
| **Error Tracking** | Sentry (production only, PII disabled) |
| **Data Isolation** | Geography-scoped queries — workers see only their assigned region/district/block/village |
| **Audit Trail** | All user/patient mutations logged via `AuditLog` model |
| **Version Gating** | Backend-enforced minimum app version; blocks outdated clients |
| **CORS** | Restricted to `/api/` paths via `CORS_URLS_REGEX` |

---

## Production Deployment

### Critical Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DJANGO_SECRET_KEY` | ✅ | Unique 50+ char random string |
| `DJANGO_DEBUG` | ✅ | Must be `false` in production |
| `DJANGO_ALLOWED_HOSTS` | ✅ | Comma-separated domain names |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string (Celery broker) |
| `CORS_ALLOWED_ORIGINS` | ✅ | Frontend origin(s) |
| `SENTRY_DSN` | Optional | Sentry project DSN (enabled when `DEBUG=false`) |
| `GEMMA_API_KEY` | Optional | Google AI API key (Gemma AI features) |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Optional | FCM push notifications |

### Production Safety (enforced at import time)

- **SECRET_KEY** — hard crash if default value when `DJANGO_DEBUG=false`
- **DEBUG** — hard crash if not explicitly `false` in production
- **ALLOWED_HOSTS** — hard crash if only localhost/127.0.0.1 in production
- **Sentry** — initialised only when `SENTRY_DSN` set AND `DEBUG=false`

### Building the APK

```bash
cd mobile
eas build --profile development --platform android   # debug APK
eas build --profile preview --platform android        # internal distribution
eas build --profile production --platform android     # Play Store release
```

---

## Operations

### Celery Workers

```bash
cd backend
celery -A shaasthi_backend worker -Q risk_assessment,celery -l info --concurrency=4
```

### Monitoring

- **Health check**: `GET /api/v1/health/` — returns DB + Celery worker status
- **Push debugging**: `python manage.py send_test_push --phone <phone>` — test FCM delivery
- **Logging**: Structured JSON in production; verbose human-readable in development; all logs PHI-redacted

### Maintenance Commands

```bash
python manage.py seed_risk_rules          # Load risk rules from fixtures
python manage.py seed_eval_data            # Seed test data for CI eval harness
python manage.py reset_dev_database        # Reset dev DB (destructive)
python manage.py send_test_push            # Test FCM push notifications
```

---

## Code Quality

```bash
# JavaScript / TypeScript
npm run lint              # ESLint
npm run format            # Prettier

# Python
npm run lint:api          # ruff check
npm run format:api        # ruff format
```

### Commit Convention

| Prefix | Usage |
|---|---|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `refactor:` | Code change without feature/bug |
| `docs:` | Documentation only |
| `test:` | Test additions/fixes |
| `perf:` | Performance improvement |
| `sec:` | Security fix |

---

## Feature Flags

All experimental features are gated behind `FEATURES` in `mobile/src/constants/featureFlags.js`. Toggle by changing `true`/`false` and rebuilding.

| Flag | Status | Description |
|---|---|---|
| `VISIT_VERIFICATION_OTP` | ✅ Enabled | OTP verification on field visits |
| `OFFLINE_MAP` | ✅ Enabled | Patient map with gender-coded markers |
| `GPS_TRACKING` | ✅ Enabled | GPS capture on visit records |
| `VOICE_INPUT` | ✅ Enabled | Hindi/English voice-to-text |
| `PDF_PAYSLIP` | ✅ Enabled | PDF payslip generation |
| `PUSH_NOTIFICATIONS` | ✅ Enabled | FCM push notifications |
| `TFLITE_SCORING` | ✅ Enabled | On-device TFLite model scoring |
| `GEMMA_ONDEVICE` | ✅ Enabled | AI Assistant chat |
| `ABDM_COMPLIANCE` | ✅ Enabled | ABDM/FHIR compliance |

---

## Key Architecture Decisions

| Decision | Rationale |
|---|---|
| **WatermelonDB** | Offline-first SQLite with built-in sync primitives; 12 local tables mirror server schema; no risk_assessments table (embedded in survey_responses) |
| **Dual risk scoring** | 27 frontend rules for instant offline scoring; backend full rules + Gemma AI for server-side enhancement |
| **OTP + JWT** | Phone-based authentication suits ASHA workers (many have basic phones with SMS); JWT enables stateless API access |
| **Bilingual UI** | All patient-facing strings in Hindi + English; ASHA workers and patients across linguistic backgrounds |
| **Hard flags** | Safety-critical symptoms (severe breathing, chest pain) must never be missed — hard flags bypass all scoring and immediately alert |
| **No referral commissions** | Incentive model rewards quality actions, never referral volume |
| **Geography scoping** | Workers only see their assigned region/district/block/village; prevents data leakage across administrative boundaries |
| **Feature flags** | Every experimental feature defaults to `false`; toggle without code changes or redeployment |

---

## License

MIT — see [LICENSE](LICENSE) for full text.

---

<p align="center">
  <strong>Built for India's frontline health workers</strong><br>
  राष्ट्रीय स्वास्थ्य मिशन · National Health Mission
</p>
