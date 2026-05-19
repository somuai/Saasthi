import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { store } from "../store/store";
import { updateAccessToken, signOut } from "../features/auth/authSlice";
import { clearAuthSession } from "../features/auth/authSession";
import { API_BASE_URL, apiUrl, endpoints } from "../constants/api";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = await SecureStore.getItemAsync("refreshToken");
      if (refresh) {
        try {
          const { data } = await axios.post(apiUrl(endpoints.tokenRefresh), { refresh });
          await SecureStore.setItemAsync("accessToken", data.access);
          store.dispatch(updateAccessToken(data.access));
          original.headers.Authorization = `Bearer ${data.access}`;
          return apiClient(original);
        } catch {
          await clearAuthSession();
          store.dispatch(signOut());
        }
      }
    }
    return Promise.reject(error);
  }
);

export { endpoints, apiUrl };
