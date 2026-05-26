import AsyncStorage from "@react-native-async-storage/async-storage";

import { setTokens, clearTokens } from "../../services/auth";

export const AUTH_USER_KEY = "shaasthi_auth_user_json";
export const AUTH_WORKER_KEY = "shaasthi_auth_worker_json";
/** Survives app kill between login and OTP verify */
export const AUTH_PENDING_PHONE_KEY = "shaasthi_auth_pending_phone";
export const AUTH_PENDING_LOCALE_KEY = "shaasthi_auth_pending_locale";

/** Network / unreachable — allow offline pilot login */
export function shouldFallbackToOfflinePilot(error) {
  return !error?.response;
}

/** Server rejected OTP — do not treat as offline pilot */
export function isInvalidOtpError(error) {
  const status = error?.response?.status;
  return status === 400 || status === 401;
}

export async function persistAuthTokens({ access, refresh }) {
  await setTokens({ access, refresh });
}

export async function persistAuthSession(user, worker) {
  if (user) await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  if (worker) await AsyncStorage.setItem(AUTH_WORKER_KEY, JSON.stringify(worker));
}

export async function persistPendingLogin({ phone, locale }) {
  if (phone) await AsyncStorage.setItem(AUTH_PENDING_PHONE_KEY, String(phone));
  if (locale) await AsyncStorage.setItem(AUTH_PENDING_LOCALE_KEY, String(locale));
}

export async function readPendingLogin() {
  const [phone, locale] = await Promise.all([AsyncStorage.getItem(AUTH_PENDING_PHONE_KEY), AsyncStorage.getItem(AUTH_PENDING_LOCALE_KEY)]);
  return { phone: phone || "", locale: locale || "hi" };
}

export async function clearPendingLogin() {
  await AsyncStorage.multiRemove([AUTH_PENDING_PHONE_KEY, AUTH_PENDING_LOCALE_KEY]);
}

export async function clearAuthSession() {
  await AsyncStorage.multiRemove([AUTH_USER_KEY, AUTH_WORKER_KEY, AUTH_PENDING_PHONE_KEY, AUTH_PENDING_LOCALE_KEY]);
  await clearTokens();
}
