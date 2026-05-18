import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useDatabase } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import { useSelector, useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { GovtHeader } from "../../components/GovtHeader";
import { COLORS } from "../../constants/colors";
import { todayYmd, timeAgo, firstDayOfMonthYmd } from "../../utils/dateHelpers";
import { syncWithServer, countPendingRecords } from "../../database/sync";
import { setPendingCount, syncStarted, syncSucceeded, syncFailed } from "../../features/sync/syncSlice";

export default function HomeScreen() {
  const router = useRouter();
  const database = useDatabase();
  const dispatch = useDispatch();
  const worker = useSelector((s) => s.auth.workerData);
  const { pendingCount, lastSyncedAt, isSyncing, isOnline } = useSelector((s) => s.sync);

  const [surveysToday, setSurveysToday] = useState(0);
  const [overdueFu, setOverdueFu] = useState(0);
  const [criticalN, setCriticalN] = useState(0);
  const [monthInr, setMonthInr] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    const t = todayYmd();
    const startM = firstDayOfMonthYmd();
    try {
      const s1 = await database.collections
        .get("survey_responses")
        .query(Q.where("survey_date", t), Q.where("is_deleted", false))
        .fetchCount();
      setSurveysToday(s1);
      const s2 = await database.collections
        .get("follow_ups")
        .query(Q.where("is_completed", false), Q.where("due_date", Q.lt(t)), Q.where("is_deleted", false))
        .fetchCount();
      setOverdueFu(s2);
      const s3 = await database.collections
        .get("patients")
        .query(Q.where("risk_level", "critical"), Q.where("is_deleted", false))
        .fetchCount();
      setCriticalN(s3);
      const rows = await database.collections
        .get("incentive_records")
        .query(Q.where("period_date", Q.gte(startM)), Q.where("is_deleted", false))
        .fetch();
      const sum = rows.reduce((a, r) => a + (r.amountInr ?? r.amount_inr ?? 0), 0);
      setMonthInr(sum);
      const pend = await countPendingRecords();
      dispatch(setPendingCount(pend));
    } catch {
      /* ignore */
    }
  }, [database, dispatch]);

  useEffect(() => {
    const sub = database.collections.get("patients").query().observe().subscribe(() => {
      reload();
    });
    reload();
    return () => sub.unsubscribe();
  }, [database, reload]);

  async function onRefresh() {
    setRefreshing(true);
    dispatch(syncStarted());
    try {
      const r = await syncWithServer();
      dispatch(syncSucceeded({ syncedAt: new Date().toISOString(), pendingCount: r.pendingCount ?? 0 }));
    } catch (e) {
      dispatch(syncFailed(e?.message || "sync failed"));
    }
    await reload();
    setRefreshing(false);
  }

  const initials = (worker?.name || "A").slice(0, 2);

  return (
    <View style={styles.page}>
      <GovtHeader titleHi="होम" title="Home" showSync />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.card}>
          <View style={styles.greetRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarTxt}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.hi}>नमस्ते, {worker?.name || "ASHA"}!</Text>
              <Text style={styles.meta}>
                {worker?.village || "—"}, {worker?.block || "—"}
              </Text>
              <Text style={styles.id}>ID: {worker?.workerCode || "—"}</Text>
            </View>
            <Text style={styles.syncTiny}>Last sync / आखरी सिंक: {timeAgo(lastSyncedAt)}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          {[
            { n: surveysToday, hi: "आज सर्वे", en: "Surveys", c: COLORS.primary },
            { n: overdueFu, hi: "फॉलो-अप", en: "Overdue", c: overdueFu > 0 ? COLORS.danger : COLORS.success },
            { n: pendingCount, hi: "सिंक बाकी", en: "Pending", c: pendingCount > 0 ? COLORS.accent : COLORS.success },
            { n: `₹${Math.round(monthInr)}`, hi: "इस माह", en: "Earned", c: COLORS.success },
          ].map((b) => (
            <View key={b.hi} style={styles.statBox}>
              <Text style={[styles.statNum, { color: b.c }]}>{b.n}</Text>
              <Text style={styles.statHi}>{b.hi}</Text>
              <Text style={styles.statEn}>{b.en}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionHi}>त्वरित क्रियाएं</Text>
        <Text style={styles.sectionEn}>Quick Actions</Text>
        <View style={styles.grid}>
          <Pressable style={styles.qCard} onPress={() => router.push("/(tabs)/patients")}>
            <Ionicons name="clipboard-outline" size={36} color={COLORS.accent} />
            <Text style={styles.qHi}>नया सर्वे</Text>
            <Text style={styles.qEn}>New Survey</Text>
          </Pressable>
          <Pressable style={styles.qCard} onPress={() => router.push("/(tabs)/patients/add")}>
            <Ionicons name="person-add-outline" size={36} color={COLORS.primary} />
            <Text style={styles.qHi}>मरीज जोड़ें</Text>
            <Text style={styles.qEn}>Add Patient</Text>
          </Pressable>
          <Pressable style={styles.qCard} onPress={() => router.push("/(tabs)/followups")}>
            <Ionicons name="calendar-outline" size={36} color={COLORS.success} />
            <Text style={styles.qHi}>फॉलो-अप</Text>
            <Text style={styles.qEn}>Follow-ups</Text>
            {overdueFu > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>{overdueFu}</Text>
              </View>
            ) : null}
          </Pressable>
          <Pressable style={styles.qCard} onPress={onRefresh}>
            <Ionicons name="refresh" size={36} color={isSyncing ? COLORS.accent : COLORS.textSecondary} />
            <Text style={styles.qHi}>सिंक</Text>
            <Text style={styles.qEn}>{isOnline ? "Sync Now" : "Offline"}</Text>
          </Pressable>
        </View>

        {criticalN > 0 ? (
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>तत्काल ध्यान / Urgent: {criticalN} critical</Text>
          </View>
        ) : null}

        <Text style={styles.disclaimer}>
          Incentives are activity and outcome based — no per-patient brokerage. / प्रोत्साहन गतिविधि पर आधारित।
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: 32 },
  card: {
    margin: 16,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  greetRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { color: "#fff", fontSize: 20, fontWeight: "800" },
  hi: { fontSize: 17, fontWeight: "800", color: COLORS.textPrimary },
  meta: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  id: { fontSize: 12, color: COLORS.textHint, marginTop: 2 },
  syncTiny: { fontSize: 10, color: COLORS.textHint, maxWidth: 90 },
  statsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  statNum: { fontSize: 22, fontWeight: "800" },
  statHi: { fontSize: 10, color: COLORS.textSecondary, marginTop: 4 },
  statEn: { fontSize: 9, color: COLORS.textHint },
  sectionHi: { fontSize: 14, fontWeight: "800", color: COLORS.textPrimary, marginHorizontal: 16, marginTop: 8 },
  sectionEn: { fontSize: 11, color: COLORS.textSecondary, marginHorizontal: 16, marginBottom: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 16 },
  qCard: {
    width: "47%",
    minHeight: 100,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    position: "relative",
  },
  qHi: { fontSize: 13, fontWeight: "800", color: COLORS.textPrimary, marginTop: 8 },
  qEn: { fontSize: 11, color: COLORS.textSecondary },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: COLORS.danger,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
  alertBox: {
    margin: 16,
    padding: 12,
    borderLeftWidth: 4,
    borderColor: COLORS.border,
    borderLeftColor: COLORS.danger,
    backgroundColor: COLORS.card,
    borderRadius: 8,
  },
  alertTitle: { color: COLORS.danger, fontWeight: "800" },
  disclaimer: { margin: 16, fontSize: 11, color: COLORS.textSecondary, lineHeight: 16 },
});
