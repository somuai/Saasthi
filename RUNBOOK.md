# MEDILIFT — Runbook (senior dev)

**Repo:** https://github.com/Luciferai04/Shaasthi  
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
npm run native:ios     # iOS — builds in.medilift.pilot — ~5–15 min first run
# or:
npm run native:android # Android — emulator MediLift_API_34 or ANDROID_AVD
```

**Daily dev (Metro only, after native app is installed):**

```bash
npm run start:dev      # preferred: dev client + localhost + adb reverse (Android)
# iOS: press i in Metro terminal
# Android emulator after Metro is up:
npm run android:reload
```

Legacy: `npm start` then `i` (iOS). On Android emulator, plain `npm start` often advertises a LAN IP the emulator cannot reach — use `start:dev` + `android:reload` instead.

If you see `No development build (in.medilift.pilot) is installed`, run `npm run native:ios` or `npm run native:android` again.

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
| Red screen / SQLite / `WMDatabaseBridge` | You are on Expo Go — use native build (`npm run native:ios` or `native:android`). |
| Full-screen “डेटाबेस लोड नहीं हुआ” | Reinstall dev build; do not use Expo Go. |
| Cannot connect to Metro (Android) | Run `npm run start:dev` (not plain `npm start`); then `npm run android:reload`. Dev client URL must be `http://localhost:8081` (adb reverse maps it to the Mac). |
| Kotlin build: `Package name must be…` for `in.medilift.pilot` | Run `node scripts/patch-android-kotlin-package.js` or `npm install` (postinstall patches Kotlin). |
| Red pilot banner after login | Offline OTP only — log in again with API running and use `dev_otp`. |
| Sync shows push errors | Some rows rejected (e.g. wrong worker); fix data and sync again — app keeps failed rows unsynced. |
| Server flags missing | Ensure push succeeded (no `errors`); flagging runs automatically after a clean push. |

Login: enter 10-digit mobile → OTP screen. With API running, use `dev_otp` from the API response (tap hint on OTP screen). Wrong OTP returns an error and does **not** log you in. Offline pilot session only when the API is **unreachable** (network error) — then any 6 digits completes local login. Phone/locale are saved if the app is killed on the OTP screen (`medilift_auth_pending_*` keys).

## 3. Automated verification

```bash
cd medilift-app && npm run verify   # Jest + eval-offline
# or from repo root:
make eval-offline    # no server
make eval            # requires API on :8000
```

Report: `eval/report.json`

## 4. Test counts (current)

| Suite | Command | Expected |
|-------|---------|----------|
| Mobile | `cd medilift-app && npm test` | 37 passed (13 suites) |
| API | `cd medilift-api && python manage.py test tests` | 12 passed |
| Eval | `make eval-offline` | OVERALL: PASS |
| Eval (live) | `make eval` | OVERALL: PASS (requires API :8000) |

_Last verified in CI/workspace: 2026-05-18._
