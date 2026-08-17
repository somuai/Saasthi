import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LottieWrapper } from "../../components/LottieWrapper";
import { useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { GovtHeader } from "../../components/GovtHeader";
import { LoadingState } from "../../components/LoadingState";
import { ErrorState } from "../../components/ErrorState";
import { COLORS } from "../../constants/colors";
import { timeAgo } from "../../utils/dateHelpers";
import { countPendingByTable, countPendingRecords, syncWithServer } from "../../database/sync";
import { formatSyncFailureMessage } from "../../utils/syncErrors";
import { API_BASE_URL } from "../../constants/api";
import { setPendingCount, syncFailed, syncStarted, syncSucceeded } from "../../features/sync/syncSlice";
import { signOut } from "../../features/auth/authSlice";
import { clearAuthSession } from "../../store/AppProvider";
import { tapTargetMin } from "../../constants/typography";
import { useLocale, translateHindiText } from "../../utils/localization";

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

const ESTIMATED_TOTAL = 50;

export default function SyncScreen() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { isSyncing, lastSyncedAt, lastError, isOnline, pendingCount: reduxPending, status } = useSelector((s) => s.sync);
  const isOfflinePilot = useSelector((s) => s.auth.isOfflinePilotSession);
  const [localPending, setLocalPending] = useState(0);
  const [breakdown, setBreakdown] = useState([]);
  const [showCompleteAnimation, setShowCompleteAnimation] = useState(false);

  const locale = useLocale();
  const hiText = (hi) => (locale === "en" ? hi : translateHindiText(hi, locale));

  const refresh = useCallback(async () => {
    const [n, rows] = await Promise.all([countPendingRecords(), countPendingByTable()]);
    setLocalPending(n);
    setBreakdown(rows);
    dispatch(setPendingCount(n));
  }, [dispatch]);

  useEffect(() => {
    refresh();
  }, [refresh, reduxPending]);

  async function runSync() {
    dispatch(syncStarted());
    try {
      const r = await syncWithServer();
      if (r.success) {
        dispatch(syncSucceeded({ syncedAt: new Date().toISOString(), pendingCount: r.pendingCount ?? 0 }));
        setShowCompleteAnimation(true);
        setTimeout(() => {
          setShowCompleteAnimation(false);
        }, 3000);
      } else {
        dispatch(syncFailed(formatSyncFailureMessage(r.reason || r.error || "failed")));
      }
    } catch (e) {
      dispatch(syncFailed(formatSyncFailureMessage(e)));
    }
    await refresh();
  }

  async function logout() {
    await clearAuthSession();
    dispatch(signOut());
    router.replace("/(auth)/splash");
  }

  if (status === "idle" && lastSyncedAt === null && localPending === 0) {
    return (
      <View style={styles.page}>
        <GovtHeader titleHi="सिंक और सेटिंग" title="Sync & Settings" showBack showSync={false} />
        <LoadingState />
      </View>
    );
  }

  if (status === "failed") {
    return (
      <View style={styles.page}>
        <GovtHeader titleHi="सिंक और सेटिंग" title="Sync & Settings" showBack showSync={false} />
        <ErrorState message="Sync failed." onRetry={runSync} />
      </View>
    );
  }

  const syncedPct = Math.max(0, Math.min(100, Math.round(((ESTIMATED_TOTAL - localPending) / ESTIMATED_TOTAL) * 100)));

  return (
    <View style={styles.page}>
      <GovtHeader titleHi="सिंक और सेटिंग" title="Sync & Settings" showBack showSync={false} />
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.sub}>
          {hiText("आखरी सिंक / Last sync:")} {timeAgo(lastSyncedAt, locale)}
        </Text>
        <View style={styles.netRow}>
          <View style={[styles.netDot, { backgroundColor: isOnline ? COLORS.success : COLORS.danger }]} />
          <Text style={styles.netTxt}>{isOnline ? hiText("ऑनलाइन / Online") : hiText("ऑफलाइन / Offline")}</Text>
        </View>
        <Text style={styles.api}>API: {API_BASE_URL}</Text>
        <View style={styles.card}>
          {isSyncing ? (
            <LottieWrapper name="syncing" size={100} loop={true} style={{ marginVertical: 10 }} />
          ) : (
            <Text style={styles.big}>{localPending}</Text>
          )}
          <Text style={styles.muted}>{hiText("रिकॉर्ड बाकी / Records pending sync")}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${syncedPct}%` }]} />
          </View>
          <Text style={styles.progressLbl}>{syncedPct}% synced (estimate)</Text>
          {isOfflinePilot ? <Text style={styles.warn}>{hiText("पायलट ऑफलाइन लॉगिन — सर्वर OTP से सिंक चालू करें")}</Text> : null}
          {lastError ? <Text style={styles.err}>{formatSyncFailureMessage(lastError)}</Text> : null}
        </View>

        {breakdown.length > 0 ? (
          <>
            <Text style={styles.h}>{hiText("तालिका अनुसार / By table")}</Text>
            <View style={styles.list}>
              {breakdown.map((item) => {
                const label = TABLE_LABELS[item.table] || { hi: item.table, en: item.table };
                return (
                  <View key={item.table} style={styles.row}>
                    <Text style={styles.rowHi}>{hiText(label.hi)}</Text>
                    <Text style={styles.rowEn}>{label.en}</Text>
                    <Text style={styles.rowCount}>{item.count}</Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <View style={{ alignItems: "center", marginVertical: 16 }}>
            {showCompleteAnimation && <LottieWrapper name="sync_complete" size={80} loop={false} />}
            <Text style={styles.allClear}>{hiText("सब सिंक है / All records synced")}</Text>
          </View>
        )}

        <Pressable style={[styles.btn, (!isOnline || isSyncing) && styles.btnDis]} disabled={!isOnline || isSyncing} onPress={runSync}>
          <Text style={styles.btnTxt}>{isSyncing ? hiText("सिंक हो रहा है…") : hiText("अभी सिंक करें / Sync Now")}</Text>
        </Pressable>

        <Pressable style={styles.logoutBtn} onPress={logout} accessibilityRole="button">
          <Text style={styles.logoutTxt}>{hiText("लॉग आउट / Log out")}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  scrollContainer: { flexGrow: 1, paddingBottom: 32 },
  sub: { paddingHorizontal: 16, color: COLORS.textSecondary, fontSize: 13, marginTop: 8 },
  netRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, marginTop: 8 },
  netDot: { width: 10, height: 10, borderRadius: 5 },
  netTxt: { fontSize: 13, fontWeight: "700", color: COLORS.textPrimary },
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
  progressTrack: {
    width: "100%",
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.surfaceContainer,
    marginTop: 16,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: COLORS.success, borderRadius: 4 },
  progressLbl: { fontSize: 11, color: COLORS.textHint, marginTop: 6 },
  warn: { color: COLORS.danger, marginTop: 12, fontWeight: "700", textAlign: "center" },
  err: { color: COLORS.danger, marginTop: 8, textAlign: "center" },
  h: { paddingHorizontal: 16, fontWeight: "800", color: COLORS.textPrimary, marginBottom: 8, marginTop: 8 },
  list: { paddingHorizontal: 16, marginBottom: 16 },
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
    minHeight: tapTargetMin,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDis: { opacity: 0.45 },
  btnTxt: { color: "#fff", fontWeight: "800", fontSize: 16 },
  logoutBtn: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 16,
    minHeight: tapTargetMin,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutTxt: { color: COLORS.danger, fontWeight: "800", fontSize: 15 },
});
