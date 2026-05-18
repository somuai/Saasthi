import { useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DatabaseProvider } from "@nozbe/watermelondb/react";
import { Provider } from "react-redux";
import { database } from "../database";
import { store } from "./store";
import { setOnlineStatus } from "../features/sync/syncSlice";
import { subscribeConnectivity } from "../utils/connectivity";
import { setUser, setWorkerData } from "../features/auth/authSlice";
import { initAutoSync } from "../database/sync";
import { DatabaseGate } from "../components/DatabaseGate";

const AUTH_USER_KEY = "medilift_auth_user_json";
const AUTH_WORKER_KEY = "medilift_auth_worker_json";

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
        if (u) store.dispatch(setUser(JSON.parse(u)));
        if (w) store.dispatch(setWorkerData(JSON.parse(w)));
        if (u) {
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

export function AppProvider({ children }) {
  return (
    <Provider store={store}>
      <DatabaseProvider database={database}>
        <DatabaseGate>
          <ConnectivityBridge>{children}</ConnectivityBridge>
        </DatabaseGate>
      </DatabaseProvider>
    </Provider>
  );
}

export async function persistAuthSession(user, worker) {
  if (user) await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  if (worker) await AsyncStorage.setItem(AUTH_WORKER_KEY, JSON.stringify(worker));
}

export async function clearAuthSession() {
  await AsyncStorage.multiRemove([AUTH_USER_KEY, AUTH_WORKER_KEY]);
}
