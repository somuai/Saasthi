import * as Sentry from "sentry-expo";

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: process.env.EXPO_PUBLIC_ENV || "production",
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    debug: typeof __DEV__ !== "undefined" && __DEV__,
  });
}

export default Sentry;
