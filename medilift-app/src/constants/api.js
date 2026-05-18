import Constants from "expo-constants";

/** Base URL without trailing slash — must include /api/v1 for Prompt 10 API */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiBaseUrl ||
  "http://127.0.0.1:8000/api/v1";

export const endpoints = {
  requestOtp: "/auth/otp/request/",
  verifyOtp: "/auth/otp/verify/",
  tokenRefresh: "/auth/token/refresh/",
  syncPull: "/sync/pull/",
  syncPush: "/sync/push/",
  patients: "/patients/",
  surveys: "/surveys/",
  legacyRequestOtp: "/auth/request-otp/",
  legacyVerifyOtp: "/auth/verify-otp/",
};

export function apiUrl(path) {
  const base = API_BASE_URL.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
