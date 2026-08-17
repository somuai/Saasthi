import Constants from "expo-constants";

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
const isDev = typeof __DEV__ !== "undefined" && __DEV__;

let SentryExpo = null;

try {
  SentryExpo = require("sentry-expo");
} catch {
  SentryExpo = null;
}

if (SentryExpo && DSN) {
  queueMicrotask(() => {
    try {
      SentryExpo.init({
        dsn: DSN,
        environment: process.env.EXPO_PUBLIC_ENV || "production",
        release: Constants.expoConfig?.version || "1.0.0",
        tracesSampleRate: 0.1,
        sendDefaultPii: false,
        debug: isDev,
      });
    } catch (e) {
      console.warn("[Sentry] deferred init failed:", e);
    }
  });
} else if (isDev && !DSN) {
  console.warn("[Sentry] EXPO_PUBLIC_SENTRY_DSN not set — skipping initialization");
}

function safeCall(method, ...args) {
  try {
    if (SentryExpo?.[method]) {
      return SentryExpo[method](...args);
    }
  } catch {}
}

export default SentryExpo;
export const captureException = (...args) => safeCall("captureException", ...args);
export const captureMessage = (...args) => safeCall("captureMessage", ...args);
export const addBreadcrumb = (...args) => safeCall("addBreadcrumb", ...args);
