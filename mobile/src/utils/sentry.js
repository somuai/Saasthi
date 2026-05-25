import * as Sentry from "sentry-expo";
import Constants from "expo-constants";

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
const APP_VERSION = Constants.expoConfig?.version || "1.0.0";

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.EXPO_PUBLIC_ENV || "production",
    release: APP_VERSION,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    debug: typeof __DEV__ !== "undefined" && __DEV__,
  });
} else if (typeof __DEV__ !== "undefined" && __DEV__) {
  console.warn("[Sentry] EXPO_PUBLIC_SENTRY_DSN not set — skipping initialization");
}

export default Sentry;
