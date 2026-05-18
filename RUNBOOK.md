# MEDILIFT — Runbook (senior dev)

**Repo:** https://github.com/Luciferai04/Saasthi  
**Branch:** `main` (pilot MVP)

## Prerequisites

- Node 20+, Python 3.9+, npm
- Xcode (iOS Simulator) or Android Studio — **Expo Go is not supported** (WatermelonDB needs a native build)

## 1. Backend

```bash
chmod +x scripts/dev.sh
./scripts/dev.sh
```

Or manually:

```bash
cd medilift-api && source .venv/bin/activate
pip install -r requirements/dev.txt
python manage.py migrate
python manage.py generate_mock_data --workers 1 --patients 5
python manage.py runserver 127.0.0.1:8000
```

**Physical device:** set `EXPO_PUBLIC_API_URL` to your machine LAN IP, e.g. `http://192.168.1.10:8000/api/v1`.

## 2. Mobile

**First time (install native app on simulator):**

```bash
cd medilift-app
cp .env.example .env   # optional
npm install
npm run native:ios     # builds in.medilift.pilot — ~5–15 min first run
```

**Daily dev (Metro only, after native app is installed):**

```bash
npm start
# press i for iOS simulator
```

If you see `No development build (in.medilift.pilot) is installed`, run `npm run native:ios` again.

Do **not** switch to Expo Go (`s` in Metro) — WatermelonDB will crash with `WMDatabaseBridge is not defined`.

**EAS dev build (device / cloud):**

```bash
cd medilift-app
npm install -g eas-cli   # once
eas login                # once
eas init                 # links Expo project — sets extra.eas.projectId in app.json
eas build --profile development --platform ios
# or: npm run eas:build:dev:ios
```

Profiles in [`medilift-app/eas.json`](medilift-app/eas.json): `development` (simulator), `development-device` (physical iOS), `preview`, `production`.

**Troubleshooting**

| Symptom | Fix |
|---------|-----|
| LogBox: `No route named "patients"` / `"mcp"` / `"survey"` | Ensure `app/(tabs)/patients/_layout.jsx`, `mcp/_layout.jsx`, and `survey/_layout.jsx` exist (Stack group layouts). Reload Metro. |
| Red screen / SQLite / `WMDatabaseBridge` | You are on Expo Go — use native build (`npm run native:ios`). |
| Full-screen “डेटाबेस लोड नहीं हुआ” | Reinstall dev build; do not use Expo Go. |
| Red pilot banner after login | Offline OTP only — log in again with API running and use `dev_otp`. |
| Sync shows push errors | Some rows rejected (e.g. wrong worker); fix data and sync again — app keeps failed rows unsynced. |
| Server flags missing | Ensure push succeeded (no `errors`); flagging runs automatically after a clean push. |

Login: enter 10-digit mobile → OTP screen. With API running, use `dev_otp` from the network tab / API response. Offline pilot: any 6 digits on OTP screen falls back to local session.

## 3. Automated verification

```bash
make eval-offline    # no server
make eval            # requires API on :8000
```

Report: `eval/report.json`

## 4. Test counts (current)

| Suite | Command | Expected |
|-------|---------|----------|
| Mobile | `cd medilift-app && npm test` | 17 passed |
| API | `cd medilift-api && python manage.py test tests` | 12 passed |
| Eval | `make eval` | OVERALL: PASS (requires API :8000) |

_Last verified in CI/workspace: 2026-05-18._
