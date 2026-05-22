# SHAASTHI — Cursor build guide (repo)

This repo is set up for the Cursor workflow in your SHAASTHI Final Build Guide.

## Already in repo

| Item | Location |
|------|----------|
| Cursor rules | `.cursor/rules/*.mdc` |
| MCP config | `.cursor/mcp.json` (edit postgres URL if needed) |
| Mobile app | `mobile/` |
| Sync API | `backend/` |
| Legacy pilot API | `shaasthi-backend/` |
| API contracts | `contracts/` |
| Reference PDFs | `mobile/docs/reference/` |

## Cursor settings (manual)

In Cursor → Settings, enable Agent, YOLO mode, Iterate on Lints, Memories, Codebase Indexing.

**Suggested memory to paste:**

> SHAASTHI: Offline-first Expo SDK 50 ASHA app. WatermelonDB + Redux. Primary #003087, accent #FF6600. Bilingual Hindi 14px / English 11px. Min tap 52px. Write Watermelon first; `scorePatient()` after survey; `backend` for sync.

## @-mentions for sessions

- `@.cursor/rules/001-always-project-context.mdc`
- `@mobile/src/database/schema.js`
- `@mobile/src/database/sync.js`
- `@mobile/src/ml/riskScorer.js`
- `@mobile/src/constants/colors.js`

## Build order (remaining work)

1. **Prompt 6** — Full survey wizard (ASHA PDF field map)
2. **Prompt 7** — MCP ANC/PNC/immunization/growth depth
3. **Prompt 8** — 25 risk rules + `mcpRiskRules` wired
4. **Prompt 9** — Earnings badges, follow-up calendar, sync breakdown
5. **Prompt 10** — Extend `backend` (accounts models, flagging, Celery, Faker mock, sklearn)

## Verify app

```bash
cd backend && . .venv/bin/activate && python manage.py runserver
cd mobile && npm start
```

Branch: `cursor/shaasthi-phased-build`
