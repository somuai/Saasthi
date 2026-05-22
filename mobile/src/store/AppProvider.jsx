import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { DatabaseProvider } from "@nozbe/watermelondb/react";
import { Provider } from "react-redux";
import { getDatabase, isWatermelonNativeAvailable } from "../database";
import { store } from "./store";
import { setOnlineStatus } from "../features/sync/syncSlice";
import { subscribeConnectivity } from "../utils/connectivity";
import { setUser, setWorkerData, setTokens, setOfflinePilotSession } from "../features/auth/authSlice";
import {
  AUTH_USER_KEY,
  AUTH_WORKER_KEY,
  clearAuthSession,
  persistAuthSession,
} from "../features/auth/authSession";
import { DatabaseGate } from "../components/DatabaseGate";

export { clearAuthSession, persistAuthSession };

function ConnectivityBridge({ children }) {
  useEffect(() => {
    const unsub = subscribeConnectivity((online) => {
      store.dispatch(setOnlineStatus(online));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    let stopAutoSync;
    (async () => {
      try {
        const u = await AsyncStorage.getItem(AUTH_USER_KEY);
        const w = await AsyncStorage.getItem(AUTH_WORKER_KEY);
        const access = await SecureStore.getItemAsync("accessToken");
        const refresh = await SecureStore.getItemAsync("refreshToken");
        if (access) store.dispatch(setTokens({ access, refresh }));
        if (u) store.dispatch(setUser(JSON.parse(u)));
        if (w) store.dispatch(setWorkerData(JSON.parse(w)));
        store.dispatch(setOfflinePilotSession(Boolean(u && !access)));
        if (u && access && isWatermelonNativeAvailable()) {
          const { initAutoSync } = await import("../database/sync");
          stopAutoSync = initAutoSync();
        }
      } catch {
        /* ignore */
      }
    })();
    return () => stopAutoSync?.();
  }, []);

  return children;
}

function DatabaseShell({ children }) {
  if (!isWatermelonNativeAvailable()) {
    return <ConnectivityBridge>{children}</ConnectivityBridge>;
  }

  return (
    <DatabaseProvider database={getDatabase()}>
      <DatabaseGate>
        <ConnectivityBridge>{children}</ConnectivityBridge>
      </DatabaseGate>
    </DatabaseProvider>
  );
}

export function AppProvider({ children }) {
  return (
    <Provider store={store}>
      <DatabaseShell>{children}</DatabaseShell>
    </Provider>
  );
}
