import AsyncStorage from "@react-native-async-storage/async-storage";
import { synchronize } from "@nozbe/watermelondb/sync";
import { Q } from "@nozbe/watermelondb";
import { store } from "../store/store";
import { setPendingCount, setOnlineStatus, syncFailed, syncStarted, syncSucceeded } from "../features/sync/syncSlice";
import { subscribeConnectivity, fetchIsOnline } from "../utils/connectivity";
import { apiClient } from "../api/client";
import { endpoints } from "../constants/api";
import { getDatabase } from "./getDatabase";
import { isWatermelonNativeAvailable } from "./isNativeAvailable";
import { getDeviceId } from "../utils/deviceId";
import { formatSyncPushErrors } from "../utils/syncErrors";
import { registerBackgroundSync } from "./backgroundSync";
import { sleep, syncJitterMs } from "../utils/syncJitter";
import Constants from "expo-constants";

const LAST_PULLED_KEY = "shaasthi_last_pulled_at";

const TABLES = [
  "patients",
  "households",
  "survey_responses",
  "follow_ups",
  "flags",
  "referrals",
  "mother_records",
  "immunization_records",
  "growth_records",
  "incentive_records",
  "anc_visit_records",
  "child_development",
  "location_logs",
];

let connectivityUnsub = null;
let syncInFlight = false;

export async function countPendingRecords() {
  const rows = await countPendingByTable();
  return rows.reduce((sum, r) => sum + r.count, 0);
}

/** Per-table unsynced counts for sync status UI */
export async function countPendingByTable() {
  if (!isWatermelonNativeAvailable()) return [];
  const database = getDatabase();
  const rows = [];
  for (const table of TABLES) {
    try {
      const count = await database.collections.get(table).query(Q.where("is_synced", false)).fetchCount();
      if (count > 0) rows.push({ table, count });
    } catch {
      /* table missing in tests */
    }
  }
  return rows.sort((a, b) => b.count - a.count);
}

async function getLastPulledAt() {
  const raw = await AsyncStorage.getItem(LAST_PULLED_KEY);
  return raw ? Number(raw) : 0;
}

async function setLastPulledAt(ts) {
  await AsyncStorage.setItem(LAST_PULLED_KEY, String(ts));
}

/** Subscribe to NetInfo, refresh pending count, auto-sync when online */
export function initAutoSync() {
  if (!isWatermelonNativeAvailable()) return () => {};
  countPendingRecords().then((c) => store.dispatch(setPendingCount(c)));
  if (connectivityUnsub) return connectivityUnsub;

  connectivityUnsub = subscribeConnectivity(async (online) => {
    store.dispatch(setOnlineStatus(online));
    if (online && !syncInFlight) {
      try {
        await sleep(syncJitterMs());
        await syncWithServer();
      } catch {
        /* best-effort background sync */
      }
    }
  });

  fetchIsOnline().then(async (online) => {
    store.dispatch(setOnlineStatus(online));
    if (online) {
      try {
        await sleep(syncJitterMs());
        await syncWithServer();
      } catch {
        /* ignore */
      }
    }
  });

  registerBackgroundSync().catch(() => {});

  return () => {
    connectivityUnsub?.();
    connectivityUnsub = null;
  };
}

/** WatermelonDB synchronize against the Shaasthi API */
export async function syncWithServer() {
  if (!isWatermelonNativeAvailable()) {
    return { success: false, reason: "native_db_unavailable" };
  }
  const database = getDatabase();
  if (syncInFlight) return { success: false, reason: "sync_in_progress" };
  const { auth } = store.getState();
  if (auth.isOfflinePilotSession || !auth.accessToken) {
    const msg = "offline_pilot_no_token";
    store.dispatch(syncFailed(msg));
    return { success: false, reason: msg };
  }
  syncInFlight = true;
  store.dispatch(syncStarted());
  try {
    const online = await fetchIsOnline();
    if (!online) {
      store.dispatch(syncFailed("offline"));
      return { success: false, reason: "offline" };
    }

    await synchronize({
      database,
      pullChanges: async ({ lastPulledAt }) => {
        const since = lastPulledAt ?? (await getLastPulledAt());
        const { data } = await apiClient.get(endpoints.syncPull, {
          params: { last_pulled_at: since || 0 },
        });
        return { changes: data.changes, timestamp: data.timestamp };
      },
      pushChanges: async ({ changes, lastPulledAt }) => {
        const { data } = await apiClient.post(endpoints.syncPush, {
          changes,
          last_pulled_at: lastPulledAt ?? (await getLastPulledAt()),
          device_id: await getDeviceId(),
          app_version: Constants.expoConfig?.version || "0.1.0",
        });
        const pushErrors = (data?.results || []).filter((r) => r.status === "error");
        if (pushErrors.length > 0) {
          const errorList = pushErrors.map((r) => ({
            id: r.local_uuid,
            table: r.model,
            error: r.message || "unknown_error",
          }));
          const msg = formatSyncPushErrors(errorList) || "sync_push_failed";
          const err = new Error(msg);
          err.code = "SYNC_PUSH_ERRORS";
          err.pushErrors = errorList;
          err.processed = data?.results;
          throw err;
        }
      },
      migrationsEnabledAtVersion: 1,
    });

    const ts = Date.now();
    await setLastPulledAt(ts);
    const pending = await countPendingRecords();
    store.dispatch(syncSucceeded({ syncedAt: new Date().toISOString(), pendingCount: pending }));
    return { success: true, pendingCount: pending };
  } catch (e) {
    const msg = e?.response?.data?.detail || e?.message || "sync_failed";
    store.dispatch(syncFailed(msg));
    return { success: false, error: msg };
  } finally {
    syncInFlight = false;
  }
}
