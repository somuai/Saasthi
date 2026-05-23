import { apiUrl, endpoints } from "../constants/api";

async function postJson(path, body, fetchImpl) {
  const response = await fetchImpl(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Sync failed with ${response.status}`);
  return response.json();
}

export function createSyncClient({ db, fetchImpl = fetch, useMock = true } = {}) {
  return {
    async syncNow() {
      const pending = db.getPendingChanges();
      if (useMock) {
        await Promise.all(
          pending.map(({ collection, record }) =>
            db.markSynced(collection, record.localId, record.sync.remoteId || `mock_${record.localId}`),
          ),
        );
        return { pushed: pending.length, pulled: 0, mode: "mock" };
      }

      const pushResult = await postJson(endpoints.syncPush, { changes: pending }, fetchImpl);
      await Promise.all(
        pending.map(({ collection, record }) => db.markSynced(collection, record.localId, pushResult.remoteIds?.[record.localId])),
      );
      const pullResult = await postJson(endpoints.syncPull, { since: pushResult.serverCursor }, fetchImpl);
      return { pushed: pending.length, pulled: pullResult.changes?.length || 0, mode: "api" };
    },
  };
}
