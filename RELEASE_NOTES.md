# Saasthi (साथी) — Release Notes

## Version: v1.0.0 (Production Release)
**Release Date:** August 2026  
**Target Environment:** Production / Hybrid Deployment (Rural PHCs & District Command Centers)

---

## Executive Summary

Saasthi v1.0.0 marks the official production-grade milestone of the maternal and child health operating system designed for India's 1M+ frontline ASHA health workers and district health supervisors. 

This release unifies a fully offline-capable mobile application (WatermelonDB + Expo SDK 52), a high-throughput Django REST API backend (493 automated tests passing), an asynchronous clinical AI triage engine (Google Gemma-4 31B IT), an Uber-inspired geospatial dispatch and H3 indexing engine, and an automated supervisor triage dashboard (Next.js 16 + React 18).

---

## Key Highlights & Features

### 1. Offline-First Mobile Experience (`/mobile`)
- **Complete MCP Card Workflows:** Digital replacement for paper Mother and Child Protection cards, supporting Antenatal Care (ANC 1–4+), Postnatal Care (PNC Days 1, 3, 7, 14, 21, 28, 42), Child Growth monitoring (WHO percentile curves), and Immunization schedules (BCG to DPT Booster).
- **WatermelonDB Sync Engine:** Robust timestamp-based delta push/pull synchronization with conflict resolution and cryptographic client record UUIDs.
- **Bilingual & Voice-Assisted Interface:** Complete English/Hindi UI localization with real-time speech input integration for hands-free clinical field note dictation.
- **GPS-Verified Doorstep Visits:** Real-time geodesic distance calculation against registered household coordinates (`classify_gps_visit`), safeguarding against unverified survey data.

### 2. Clinical Intelligence & Risk Engine (`/backend/risk_engine`)
- **Deterministic 27-Rule Validator:** Real-time clinical scoring on systolic/diastolic BP, hemoglobin, blood glucose, proteinuria, fetal movements, and past obstetric complications.
- **Hard-Flag Safety Interlocks:** Non-overridable emergency triggers for eclampsia, antepartum/postpartum hemorrhage, severe anemia (<7.0 g/dL), and obstructed labor.
- **Google Gemma-4 AI Enhancement:** Background Celery task (`enhance_with_gemma4`) generating explainable clinical rationales, dietary recommendations, and differential risk indicators.

### 3. Uber-Style Dispatch & Geospatial Analytics (`/backend/dispatch`, `/dashboard`)
- **Uber H3 Hierarchical Spatial Indexing:** Server-side aggregation of population health metrics and maternal risk densities into hexagonal spatial cells (Resolution 7–9) for zero-lag map rendering.
- **Haversine Algorithmic Dispatch:** Dynamic scoring and dispatching of nearest available ASHA workers for maternal emergency response factoring in geodesic proximity, active patient load, and worker status.
- **State Machine Architecture:** Strict lifecycle management (`Pending` ➔ `Assigned` ➔ `EnRoute` ➔ `OnSite` ➔ `Resolved`) with automatic supervisor escalation timers.

### 4. Automated Incentive Calculation (`/backend/incentives`)
- **GoI 2025–26 Rate Card Integration:** Automated ledger accrual for ANC registration (₹300), Institutional Delivery facilitation (₹600), Full Immunization Coverage (₹500), and Child Growth follow-ups (₹150).
- **Supervisor Approval Workflow:** Role-gated batch approval and payment status tracking (`approve/`, `mark_paid`) with complete audit trails.

### 5. Supervisor Operations Dashboard (`/dashboard`)
- **Modern Next.js 16 (Turbopack) Stack:** Strict TypeScript architecture with zero build or type errors.
- **Live Triage & Geospatial View:** Interactive Leaflet/OSM map with H3 hexagonal density layers, live activity feeds, and fast patient search.
- **Secure Two-Tier Authentication:** Secure OTP fallback with rate throttling and JWT token rotation.

---

## Verification & Quality Metrics

| Component | Metric | Status |
| :--- | :--- | :--- |
| **Backend Pytest** | **493 Passing Tests** | Passed (100%) |
| **Backend Ruff Lint** | **0 Errors / Clean** | Passed |
| **Mobile Jest Suites** | **14 Suites (44 Tests Passing)** | Passed (100%) |
| **Mobile ESLint** | **0 Errors / 0 Warnings** | Passed |
| **Dashboard TypeScript** | **Zero Type Errors (`tsc --noEmit`)** | Passed |
| **Dashboard ESLint** | **0 Errors** | Passed |
| **Security & CORS** | Multi-Origin Support (`localhost:3000`, `8081`) | Verified |

---

## Release Checklist & Upgrade Instructions

### Backend Upgrades
1. Apply latest Django database migrations:
   ```bash
   python manage.py migrate
   ```
2. Seed initial MCP risk rules and GoI incentive rate tables:
   ```bash
   python manage.py seed_mcp_risk_rules
   python manage.py seed_incentive_rates
   ```
3. Start Celery worker and scheduler:
   ```bash
   celery -A shaasthi_backend worker -Q risk_assessment,celery -l info
   celery -A shaasthi_backend beat -l info --schedule=/tmp/celerybeat-schedule
   ```

### Mobile App Upgrades
1. Install dependencies and start Expo server:
   ```bash
   npm install
   npx expo start
   ```

### Web Dashboard Upgrades
1. Install dependencies and build production bundle:
   ```bash
   npm install
   npm run build
   npm start
   ```
