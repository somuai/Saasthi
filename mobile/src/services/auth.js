import * as SecureStore from "expo-secure-store";

const ACCESS_KEY = "accessToken";
const REFRESH_KEY = "refreshToken";

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

export async function getRefreshToken() {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function setTokens({ access, refresh }) {
  if (access) await SecureStore.setItemAsync(ACCESS_KEY, access);
  if (refresh) await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}

export async function clearTokens() {
  await Promise.allSettled([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY)]);
}
