const isDev = typeof __DEV__ !== "undefined" ? __DEV__ : process.env.NODE_ENV !== "production";

export const logger = {
  debug(...args) {
    if (isDev) console.log("[SAASTHI]", ...args);
  },
  info(...args) {
    if (isDev) console.info("[SAASTHI]", ...args);
  },
  warn(...args) {
    console.warn("[SAASTHI]", ...args);
  },
  error(...args) {
    console.error("[SAASTHI]", ...args);
  },
};
