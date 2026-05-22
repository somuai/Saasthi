const isDev = typeof __DEV__ !== "undefined" ? __DEV__ : process.env.NODE_ENV !== "production";

export const logger = {
  debug(...args) {
    if (isDev) console.log("[SHAASTHI]", ...args);
  },
  info(...args) {
    if (isDev) console.info("[SHAASTHI]", ...args);
  },
  warn(...args) {
    console.warn("[SHAASTHI]", ...args);
  },
  error(...args) {
    console.error("[SHAASTHI]", ...args);
  },
};
