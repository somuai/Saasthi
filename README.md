# MEDILIFT

MEDILIFT is a pilot-ready digital ASHA healthcare platform for offline-first field data capture, MCP Card digitization, explainable risk scoring, follow-ups, referrals, incentives, and supervisor review.

## Workspace

- `medilift-app/` - Expo React Native ASHA mobile app.
- `medilift-backend/` - Django/DRF API, sync service, risk engine, and pilot admin/dashboard.
- `docs/` - shared architecture, data dictionary, risk, sync, and compliance contracts.
- `contracts/` - machine-readable API and sync examples.

## MVP Stack

- Mobile: Expo React Native, expo-router, Redux Toolkit, offline-first local persistence.
- Backend: Django, Django REST Framework, SimpleJWT, SQLite local fallback, Postgres-ready settings.
- Risk: versioned explainable rules on-device and mirrored on the server; Random Forest is advisory/post-MVP.

## Non-Negotiables

- Every field workflow works offline.
- Every clinical or workflow write records sync and audit metadata.
- Risk outputs always include human-readable reasons.
- Incentives reward quality and outcomes, never referral volume.
- Analytics exports are aggregated/anonymized unless explicitly authorized.

## Quick Start

See:

- [Mobile README](./medilift-app/README.md)
- [Backend README](./medilift-backend/README.md)
- [Architecture](./docs/architecture.md)
- [Compliance Checklist](./docs/compliance-checklist.md)

