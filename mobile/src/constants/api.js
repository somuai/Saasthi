import Constants from "expo-constants";
import { Platform } from "react-native";

/** Base URL without trailing slash — must include /api/v1 for Prompt 10 API */
const envUrl = process.env.EXPO_PUBLIC_API_URL;
const extraUrl = Constants.expoConfig?.extra?.apiBaseUrl;
export const API_BASE_URL = envUrl || extraUrl || (__DEV__ ? "http://127.0.0.1:8000/api/v1" : "");

if (!API_BASE_URL && Platform.OS !== "web") {
  console.error("CRITICAL: EXPO_PUBLIC_API_URL not set in production build");
}

export const endpoints = {
  requestOtp: "/auth/otp/request/",
  verifyOtp: "/auth/otp/verify/",
  firebaseVerify: "/auth/firebase/verify/",
  tokenRefresh: "/auth/token/refresh/",
  syncPull: "/sync/pull/",
  syncPush: "/sync/push/",
  patients: "/registry/patients/",
  surveys: "/surveys/responses/",
  appVersion: "/config/version/",
};

export function apiUrl(path) {
  const base = API_BASE_URL.replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
