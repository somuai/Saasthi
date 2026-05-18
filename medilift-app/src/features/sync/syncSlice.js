import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  lastSyncedAt: null,
  pendingCount: 0,
  isSyncing: false,
  lastError: null,
  isOnline: true,
  /** legacy */
  lastSyncAt: null,
  status: "idle",
  error: null,
};

const syncSlice = createSlice({
  name: "sync",
  initialState,
  reducers: {
    setPendingCount(state, action) {
      state.pendingCount = action.payload;
    },
    incrementPendingCount(state, action) {
      state.pendingCount += action.payload ?? 1;
    },
    setOnlineStatus(state, action) {
      state.isOnline = action.payload;
    },
    setSyncing(state, action) {
      state.isSyncing = action.payload;
      state.status = action.payload ? "syncing" : "idle";
    },
    setSyncComplete(state, action) {
      state.isSyncing = false;
      state.status = "idle";
      state.lastSyncedAt = action.payload.lastSyncedAt;
      state.lastSyncAt = action.payload.lastSyncedAt;
      state.pendingCount = action.payload.pendingCount ?? 0;
      state.lastError = null;
      state.error = null;
    },
    setSyncError(state, action) {
      state.isSyncing = false;
      state.status = "failed";
      state.lastError = action.payload;
      state.error = action.payload;
    },
    syncStarted(state) {
      state.isSyncing = true;
      state.status = "syncing";
      state.error = null;
      state.lastError = null;
    },
    syncSucceeded(state, action) {
      state.isSyncing = false;
      state.status = "idle";
      const syncedAt = action.payload.syncedAt ?? new Date().toISOString();
      state.lastSyncedAt = syncedAt;
      state.lastSyncAt = syncedAt;
      state.pendingCount = action.payload.pendingCount ?? 0;
    },
    syncFailed(state, action) {
      state.isSyncing = false;
      state.status = "failed";
      state.error = action.payload;
      state.lastError = action.payload;
    },
  },
});

export const {
  setPendingCount,
  incrementPendingCount,
  setOnlineStatus,
  setSyncing,
  setSyncComplete,
  setSyncError,
  syncStarted,
  syncSucceeded,
  syncFailed,
} = syncSlice.actions;
export default syncSlice.reducer;
