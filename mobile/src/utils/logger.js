const isDev = typeof __DEV__ !== "undefined" ? __DEV__ : process.env.NODE_ENV !== "production";

let SentryModule;
async function getSentry() {
  if (!SentryModule) {
    try {
      SentryModule = await import("../utils/sentry");
    } catch {
      SentryModule = null;
    }
  }
  return SentryModule;
}

function safeCapture(level, args) {
  const message = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
  getSentry().then((s) => {
    if (!s) return;
    if (level === "error") {
      s.captureMessage(message, { level: "error" });
    } else if (level === "warn") {
      s.addBreadcrumb({ message, level: "warning" });
    }
  });
}

export const logger = {
  debug(...args) {
    if (isDev) console.log("[SHAASTHI]", ...args);
  },
  info(...args) {
    if (isDev) console.info("[SHAASTHI]", ...args);
  },
  warn(...args) {
    console.warn("[SHAASTHI]", ...args);
    safeCapture("warn", args);
  },
  error(...args) {
    console.error("[SHAASTHI]", ...args);
    safeCapture("error", args);
  },
};
