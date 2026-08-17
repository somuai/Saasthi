# About Saasthi (साथी)

> **Empowering India's 1 Million+ ASHA Health Workers with an Offline-First, Explainable AI Maternal & Child Health Platform.**

---

## 1. Mission & Background

In rural and semi-urban India, **Accredited Social Health Activists (ASHAs)** serve as the vital frontline of community healthcare. Responsible for door-to-door health tracking, maternal antenatal/postnatal care, child immunization, and emergency referrals across remote villages, ASHAs have historically faced significant operational bottlenecks:
- **Paper Register Burden:** Manual data entry into voluminous paper MCP (Mother and Child Protection) registers and dual entry into fragmented government portals.
- **Connectivity Deserts:** Severe internet blackouts in rural hinterlands preventing real-time cloud data entry.
- **Delayed Clinical Escalation:** Inability to immediately detect subtle, compounding maternal high-risk symptoms (e.g., severe anemia compounded with gestational hypertension).
- **Delayed Incentive Disbursal:** Lengthy reconciliation cycles for government activity incentives (National Health Mission / GoI rate cards).

**Saasthi (साथी)** was designed and engineered from the ground up to solve these fundamental challenges through a unified, offline-first mobile client, an explainable deterministic-plus-AI clinical risk engine, an Uber-inspired geospatial dispatch architecture, and a real-time supervisor triage dashboard.

---

## 2. Core Architectural Pillars

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FIELD LAYER: ASHA WORKERS                          │
│   Expo React Native (SDK 52) • WatermelonDB (Offline SQLite) • Redux Toolkit│
│   ┌───────────────────┐ ┌───────────────────┐ ┌─────────────────────────┐  │
│   │ MCP Card Workflow │ │ 7-Step Risk Survey│ │ On-Device TFLite Scorer │  │
│   │ (ANC / PNC / Imm) │ │ (Bilingual HI/EN) │ │ (Zero-latency Triage)   │  │
│   └───────────────────┘ └───────────────────┘ └─────────────────────────┘  │
│   ┌───────────────────┐ ┌───────────────────┐ ┌─────────────────────────┐  │
│   │ GPS Doorstep Auth │ │ Audio Voice Notes │ │ Incentive Ledger (GoI)  │  │
│   └───────────────────┘ └───────────────────┘ └─────────────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTPS / Sync Protocol (Delta Push/Pull)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EDGE & REVERSE PROXY LAYER                           │
│   Nginx (TLS Termination, Rate Limiting, Static Asset WhiteNoise caching)   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BACKEND & INTELLIGENCE LAYER                          │
│   Django REST Framework 5.2 • Celery Async Workers • Redis 7 • PostgreSQL 16│
│   ┌───────────────────┐ ┌───────────────────┐ ┌─────────────────────────┐  │
│   │ 27-Rule Clinical  │ │ Google Gemma-4 AI │ │ Uber-Style H3 Spatial   │  │
│   │ Rule Validator    │ │ Risk Enhancer     │ │ Emergency Dispatch Engine│  │
│   └───────────────────┘ └───────────────────┘ └─────────────────────────┘  │
│   ┌───────────────────┐ ┌───────────────────┐ ┌─────────────────────────┐  │
│   │ Geodesic Distance │ │ Two-Tier Auth     │ │ Prometheus / Sentry     │  │
│   │ Verification      │ │ (Firebase + OTP)  │ │ Real-Time Observability │  │
│   └───────────────────┘ └───────────────────┘ └─────────────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      COMMAND LAYER: SUPERVISORS & PHC                       │
│   Next.js 16 (App Router) • React 18 • TypeScript • Tailwind CSS • Radix UI │
│   ┌───────────────────┐ ┌───────────────────┐ ┌─────────────────────────┐  │
│   │ Geospatial Triage │ │ Real-Time Worker  │ │ HMIS / MoHFW            │  │
│   │ H3 Heatmap Layers │ │ Dispatch Machine  │ │ Analytical Export Engine│  │
│   └───────────────────┘ └───────────────────┘ └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### A. Offline-First Mobile Client
- **Local SQLite Storage via WatermelonDB:** Every patient record, pregnancy history, survey response, and immunization record is persisted locally with zero dependency on active internet.
- **Smart Delta Synchronization:** Uses an optimized timestamp-based push/pull protocol with cryptographic client record UUIDs, conflict resolution strategies, and automated retry mechanisms.
- **Bilingual First-Class UX:** Complete UI localization in Hindi and English with intuitive audio-assisted voice inputs for seamless field use by health workers.

### B. Hybrid Clinical Risk Engine (Deterministic + Gemma AI)
- **Deterministic 27-Rule Engine:** Evaluates clinical vitals (blood pressure, hemoglobin, blood glucose, proteinuria, edema, fundal height) against clinical safety thresholds.
- **Hard-Flag Safety Interlocks:** Instantly detects critical obstetric danger signs (e.g., eclampsia, antepartum hemorrhage, obstructed labor) and raises non-overridable emergency flags.
- **Google Gemma-4 AI Enhancement:** Asynchronously augments risk assessments with human-readable clinical summaries, differential risks, and contextual maternal diet/care recommendations.

### C. Uber-Inspired Geospatial Dispatching & H3 Indexing
- **Uber H3 Hexagonal Spatial Indexing:** Groups population metrics, worker coverage, and high-risk case densities into hierarchical hexagonal cells (Resolution 7–9), enabling lightning-fast visual rendering of thousands of data points without client-side lag.
- **Algorithmic Worker Matching:** Calculates nearest available ASHA workers for emergency response using the Haversine geodesic formula, active patient caseload weightings, and real-time status.
- **State Machine Dispatch Engine:** Enforces strict transition states (`Pending` ➔ `Assigned` ➔ `EnRoute` ➔ `OnSite` ➔ `Resolved`), ensuring zero double-dispatch race conditions.

### D. Verified Accountability & Incentives
- **GPS-Tagged Doorstep Verification:** Automatically computes geodesic distance between recorded visit coordinates and registered household coordinates (`classify_gps_visit`), ensuring genuine field visits.
- **Automated Incentive Engine:** Calculates financial incentives per Government of India (GoI) 2025–26 National Health Mission rate cards for ANC checkups, institutional deliveries, Full Immunization Coverage (FIC), and follow-ups.

---

## 3. Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Backend API** | Django 5.2, Django REST Framework, Python 3.12 |
| **Task Queue & Async** | Celery 5.4, Redis 7 (Broker & Result Backend), Celery Beat |
| **Database** | PostgreSQL 16 (Relational DB), SQLite (Local Mobile) |
| **Mobile Client** | React Native 0.73.6, Expo SDK 52, WatermelonDB, Redux Toolkit |
| **Web Dashboard** | Next.js 16 (App Router, Turbopack), React 18, TypeScript, Tailwind CSS, Radix UI |
| **AI / Machine Learning** | Google Gemma-4 31B IT, TensorFlow Lite (Mobile Edge), H3 Geospatial Indexing |
| **Infrastructure & CI** | Docker Compose, Nginx, Prometheus, Sentry SDK, Pytest, Jest, Ruff, ESLint |

---

## 4. Quality & Compliance Standards

- **Comprehensive Test Coverage:**
  - **493 Passing Backend Pytest Tests** (covering models, viewsets, risk engine, sync contracts, auth flows, geospatial dispatch, and incentives).
  - **14 Passing Mobile Jest Test Suites (44 Tests)** (covering WatermelonDB models, sync contracts, bilingual localization, scoring algorithms, and map utilities).
- **Code Cleanliness & Standards:**
  - Strict Python linting via `ruff` with 0 errors.
  - Strict JavaScript/TypeScript linting via `eslint` with 0 errors.
  - Zero TypeScript compile errors (`tsc --noEmit`).
- **Data Privacy & Governance:**
  - Two-tier authentication strategy: Firebase Phone Auth for mobile field agents + secure rate-throttled OTP fallback for web supervisors.
  - Role-Based Access Control (RBAC) scoped strictly by geographic hierarchy (`for_user_geography`).
  - Safe audit trails for all clinical triage modifications and supervisor approvals.

---

## 5. Authors & Organization

Developed and engineered by **Soumyajit Ghosh** and the Saasthi Engineering Team.
For inquiries, contributions, or pilot deployments, visit [Saasthi GitHub Repository](https://github.com/Luciferai04/Saasthi).
