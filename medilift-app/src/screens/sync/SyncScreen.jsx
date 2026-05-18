import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { GovtHeader } from "../../components/GovtHeader";
import { COLORS } from "../../constants/colors";
import { timeAgo } from "../../utils/dateHelpers";
import { countPendingRecords, syncWithServer } from "../../database/sync";
import { API_BASE_URL } from "../../constants/api";
import { setPendingCount, syncFailed, syncStarted, syncSucceeded } from "../../features/sync/syncSlice";

export default function SyncScreen() {
  const dispatch = useDispatch();
  const { pendingCount, isSyncing, lastSyncedAt, lastError, isOnline } = useSelector((s) => s.sync);
  const [localPending, setLocalPending] = useState(0);

  const refresh = useCallback(async () => {
    const n = await countPendingRecords();
    setLocalPending(n);
    dispatch(setPendingCount(n));
  }, [dispatch]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function runSync() {
    dispatch(syncStarted());
    try {
      const r = await syncWithServer();
      if (r.success) {
        dispatch(syncSucceeded({ syncedAt: new Date().toISOString(), pendingCount: r.pendingCount ?? 0 }));
      } else {
        dispatch(syncFailed(r.reason || r.error || "failed"));
      }
    } catch (e) {
      dispatch(syncFailed(e?.message || "error"));
    }
    await refresh();
  }

  return (
    <View style={styles.page}>
      <GovtHeader titleHi="डेटा सिंक" title="Data Sync" showBack showSync={false} />
      <Text style={styles.sub}>आखरी सिंक / Last sync: {timeAgo(lastSyncedAt)}</Text>
      <Text style={styles.api}>API: {API_BASE_URL}</Text>
      <View style={styles.card}>
        <Text style={styles.big}>{localPending}</Text>
        <Text style={styles.muted}>रिकॉर्ड बाकी / Records pending sync</Text>
        {!isOnline ? <Text style={styles.warn}>ऑफलाइन — नेट जुड़ने पर स्वतः सिंक</Text> : null}
        {lastError ? <Text style={styles.err}>{lastError}</Text> : null}
      </View>
      <Pressable
        style={[styles.btn, (!isOnline || isSyncing) && styles.btnDis]}
        disabled={!isOnline || isSyncing}
        onPress={runSync}
      >
        <Text style={styles.btnTxt}>अभी सिंक करें / Sync Now</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  sub: { paddingHorizontal: 16, color: COLORS.textSecondary, fontSize: 13 },
  api: { paddingHorizontal: 16, fontSize: 11, color: COLORS.textHint, marginBottom: 12 },
  card: {
    margin: 16,
    padding: 20,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  big: { fontSize: 40, fontWeight: "900", color: COLORS.accent },
  muted: { fontSize: 13, color: COLORS.textSecondary, marginTop: 8 },
  warn: { color: COLORS.danger, marginTop: 12, fontWeight: "700" },
  err: { color: COLORS.danger, marginTop: 8 },
  btn: {
    marginHorizontal: 16,
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDis: { opacity: 0.45 },
  btnTxt: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
