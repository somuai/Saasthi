# Firebase Phone Number Verification Plan

Date: 2026-06-27

## Goal

Add Firebase Phone Number Verification (PNV) as a no-SMS, one-tap phone verification path for supported Android devices and carriers, while keeping the current Firebase SMS/custom OTP flow as fallback.

## Product Flow

1. On app launch/login, check whether the Android device and carrier support Firebase PNV.
2. If supported, show a short explainer screen before the system consent UI:
   - "Verify this phone without SMS"
   - "Saasthi will ask your carrier to confirm the SIM number on this phone."
   - "No OTP is sent or shared."
3. User taps verify and completes carrier consent.
4. App receives a signed PNV token.
5. App sends the token to the backend.
6. Backend verifies the token signature, extracts the verified phone number, matches it to an active ASHA/admin user, and returns the normal JWT session.
7. If unsupported, denied, or token verification fails, fall back to current SMS/custom OTP.

## Backend Work

Add `POST /api/v1/auth/firebase/pnv/verify/`:

- Input: `{ "pnv_token": "...", "phone": "+91..." }`
- Verify token signature using Firebase PNV backend verification rules.
- Extract phone number from verified token claims.
- Normalize to E.164 India format.
- Reuse the existing auth/session creation code path.
- Audit-log provider as `firebase_pnv`.
- Return the same response shape as OTP verify: access token, refresh token, and worker profile.
- Current implementation is intentionally disabled unless `FIREBASE_PNV_ENABLED=true`; local DEBUG builds can use `test:<E164 phone>` tokens with `FIREBASE_PNV_ACCEPT_TEST_TOKENS=true`.

## Mobile Work

Add Android-only native module or Expo config plugin for the Firebase PNV Android SDK:

- `getVerificationSupportInfo()`
- `getVerifiedPhoneNumber()`
- `enableTestSession(token)` for Firebase Console test tokens

Login selection logic:

- Android + PNV available: try carrier/SIM verification first.
- Android + PNV unavailable: show SMS/custom OTP.
- iOS: keep current Firebase SMS/custom OTP.
- Development builds/emulators: keep OTP fallback unless SIM-less test mode is explicitly configured.
- Current app uses `@react-native-firebase/*` v18. The published PNV module is v25, so the adapter remains feature-flagged off until the RNFirebase stack is upgraded and the native module is installed/rebuilt.

## Safety And Rollout

- Feature flag: `EXPO_PUBLIC_FIREBASE_PNV_ENABLED=false` by default.
- Backend env flag: `FIREBASE_PNV_ENABLED=false` by default.
- Dev verifier flag: `FIREBASE_PNV_ACCEPT_TEST_TOKENS=false` by default and only honored when `DEBUG=true`.
- Sentry tags: `auth_provider=firebase_pnv|firebase_sms|custom_otp`.
- Metrics:
  - PNV availability rate
  - consent completion rate
  - fallback reason
  - median verification duration
  - failed token verification count

## Why Not Directly Ship Today

Firebase PNV is Android-only, depends on device/carrier support, and requires official Firebase PNV project/API onboarding plus backend token verification. Shipping a UI-only imitation would be worse than SMS OTP because it would create false trust in identity verification.
