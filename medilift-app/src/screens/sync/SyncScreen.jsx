import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { GovtHeader } from "../../components/GovtHeader";
import { COLORS } from "../../constants/colors";
import { timeAgo } from "../../utils/dateHelpers";
import { countPendingByTable, countPendingRecords, syncWithServer } from "../../database/sync";
import { API_BASE_URL } from "../../constants/api";
import { setPendingCount, syncFailed, syncStarted, syncSucceeded } from "../../features/sync/syncSlice";

const TABLE_LABELS = {
  patients: { hi: "मरीज", en: "Patients" },
  households: { hi: "परिवार", en: "Households" },
  survey_responses: { hi: "सर्वे", en: "Surveys" },
  follow_ups: { hi: "फॉलो-अप", en: "Follow-ups" },
  flags: { hi: "फ्लैग", en: "Flags" },
  referrals: { hi: "रेफरल", en: "Referrals" },
  mother_records: { hi: "मातृ रजिस्टर", en: "Mother records" },
  immunization_records: { hi: "टीका", en: "Immunization" },
  growth_records: { hi: "विकास", en: "Growth" },
  incentive_records: { hi: "प्रोत्साहन", en: "Incentives" },
  anc_visit_records: { hi: "ANC", en: "ANC visits" },
  child_development: { hi: "बाल विकास", en: "Child dev." },
};

export default function SyncScreen() {
  const dispatch = useDispatch();
  const { isSyncing, lastSyncedAt, lastError, isOnline } = useSelector((s) => s.sync);
  const [localPending, setLocalPending] = useState(0);
  const [breakdown, setBreakdown] = useState([]);

  const refresh = useCallback(async () => {
    const [n, rows] = await Promise.all([countPendingRecords(), countPendingByTable()]);
    setLocalPending(n);
    setBreakdown(rows);
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

      {breakdown.length > 0 ? (
        <>
          <Text style={styles.h}>तालिका अनुसार / By table</Text>
          <FlatList
            data={breakdown}
            keyExtractor={(item) => item.table}
            style={styles.list}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }}
            renderItem={({ item }) => {
              const label = TABLE_LABELS[item.table] || { hi: item.table, en: item.table };
              return (
                <View style={styles.row}>
                  <Text style={styles.rowHi}>{label.hi}</Text>
                  <Text style={styles.rowEn}>{label.en}</Text>
                  <Text style={styles.rowCount}>{item.count}</Text>
                </View>
              );
            }}
          />
        </>
      ) : (
        <Text style={styles.allClear}>सब सिंक है / All records synced</Text>
      )}

      <Pressable
        style={[styles.btn, (!isOnline || isSyncing) && styles.btnDis]}
        disabled={!isOnline || isSyncing}
        onPress={runSync}
      >
        <Text style={styles.btnTxt}>{isSyncing ? "सिंक हो रहा है…" : "अभी सिंक करें / Sync Now"}</Text>
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
    marginBottom: 8,
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
  h: { paddingHorizontal: 16, fontWeight: "800", color: COLORS.textPrimary, marginBottom: 8 },
  list: { flexGrow: 0, maxHeight: 280 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  rowHi: { flex: 1, fontWeight: "700", color: COLORS.textPrimary },
  rowEn: { flex: 1, fontSize: 12, color: COLORS.textSecondary },
  rowCount: { fontWeight: "900", color: COLORS.accent, minWidth: 32, textAlign: "right" },
  allClear: { textAlign: "center", color: COLORS.success, fontWeight: "700", marginVertical: 16 },
  btn: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 24,
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDis: { opacity: 0.45 },
  btnTxt: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
