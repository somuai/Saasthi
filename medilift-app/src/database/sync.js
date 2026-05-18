import AsyncStorage from "@react-native-async-storage/async-storage";
import { synchronize } from "@nozbe/watermelondb/sync";
import { Q } from "@nozbe/watermelondb";
import { store } from "../store/store";
import { setPendingCount, setOnlineStatus, syncFailed, syncStarted, syncSucceeded } from "../features/sync/syncSlice";
import { subscribeConnectivity, fetchIsOnline } from "../utils/connectivity";
import { apiClient } from "../api/client";
import { endpoints } from "../constants/api";
import { database } from "./index";

const LAST_PULLED_KEY = "medilift_last_pulled_at";

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
];

let connectivityUnsub = null;
let syncInFlight = false;

export async function countPendingRecords() {
  let total = 0;
  for (const table of TABLES) {
    try {
      const n = await database.collections.get(table).query(Q.where("is_synced", false)).fetchCount();
      total += n;
    } catch {
      /* table missing in tests */
    }
  }
  return total;
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
  countPendingRecords().then((c) => store.dispatch(setPendingCount(c)));
  if (connectivityUnsub) return connectivityUnsub;

  connectivityUnsub = subscribeConnectivity(async (online) => {
    store.dispatch(setOnlineStatus(online));
    if (online && !syncInFlight) {
      try {
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
        await syncWithServer();
      } catch {
        /* ignore */
      }
    }
  });

  return () => {
    connectivityUnsub?.();
    connectivityUnsub = null;
  };
}

/** WatermelonDB synchronize against medilift-api */
export async function syncWithServer() {
  if (syncInFlight) return { success: false, reason: "sync_in_progress" };
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
        await apiClient.post(endpoints.syncPush, {
          changes,
          last_pulled_at: lastPulledAt ?? (await getLastPulledAt()),
        });
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
