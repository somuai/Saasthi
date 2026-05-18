# MEDILIFT — Cursor build guide (repo)

This repo is set up for the Cursor workflow in your MEDILIFT Final Build Guide.

## Already in repo

| Item | Location |
|------|----------|
| Cursor rules | `.cursor/rules/*.mdc` |
| MCP config | `.cursor/mcp.json` (edit postgres URL if needed) |
| Mobile app | `medilift-app/` |
| Sync API | `medilift-api/` |
| Legacy pilot API | `medilift-backend/` |
| API contracts | `contracts/` |
| Reference PDFs | `medilift-app/docs/reference/` |

## Cursor settings (manual)

In Cursor → Settings, enable Agent, YOLO mode, Iterate on Lints, Memories, Codebase Indexing.

**Suggested memory to paste:**

> MEDILIFT: Offline-first Expo SDK 50 ASHA app. WatermelonDB + Redux. Primary #003087, accent #FF6600. Bilingual Hindi 14px / English 11px. Min tap 52px. Write Watermelon first; `scorePatient()` after survey; `medilift-api` for sync.

## @-mentions for sessions

- `@.cursor/rules/001-always-project-context.mdc`
- `@medilift-app/src/database/schema.js`
- `@medilift-app/src/database/sync.js`
- `@medilift-app/src/ml/riskScorer.js`
- `@medilift-app/src/constants/colors.js`

## Build order (remaining work)

1. **Prompt 6** — Full survey wizard (ASHA PDF field map)
2. **Prompt 7** — MCP ANC/PNC/immunization/growth depth
3. **Prompt 8** — 25 risk rules + `mcpRiskRules` wired
4. **Prompt 9** — Earnings badges, follow-up calendar, sync breakdown
5. **Prompt 10** — Extend `medilift-api` (accounts models, flagging, Celery, Faker mock, sklearn)

## Verify app

```bash
cd medilift-api && . .venv/bin/activate && python manage.py runserver
cd medilift-app && npm start
```

Branch: `cursor/medilift-phased-build`
