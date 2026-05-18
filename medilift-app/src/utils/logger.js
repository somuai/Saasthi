const isDev = typeof __DEV__ !== "undefined" ? __DEV__ : process.env.NODE_ENV !== "production";

export const logger = {
  debug(...args) {
    if (isDev) console.log("[MEDILIFT]", ...args);
  },
  info(...args) {
    if (isDev) console.info("[MEDILIFT]", ...args);
  },
  warn(...args) {
    console.warn("[MEDILIFT]", ...args);
  },
  error(...args) {
    console.error("[MEDILIFT]", ...args);
  },
};
