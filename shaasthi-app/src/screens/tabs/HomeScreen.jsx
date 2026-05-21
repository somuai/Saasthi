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
import { BentoStatGrid } from "../../components/BentoStatGrid";
import { SyncPendingBanner } from "../../components/SyncPendingBanner";
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
  const [householdCount, setHouseholdCount] = useState(0);
  const [overdueFu, setOverdueFu] = useState(0);
  const [criticalN, setCriticalN] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    const t = todayYmd();
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
      const hh = await database.collections
        .get("households")
        .query(Q.where("is_deleted", false))
        .fetchCount();
      setHouseholdCount(hh);
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
  const hour = new Date().getHours();
  const greetEn = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const greetHi = hour < 12 ? "सुप्रभात" : hour < 17 ? "नमस्ते" : "शुभ संध्या";

  return (
    <View style={styles.page}>
      <GovtHeader
        titleHi="होम"
        title="Home"
        showSync
        rightComponent={
          <Pressable onPress={() => router.push("/(tabs)/sync")} style={styles.notifBtn}>
            <Ionicons name="notifications-outline" size={24} color="#fff" />
            {pendingCount > 0 ? (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeTxt}>{pendingCount > 9 ? "9+" : pendingCount}</Text>
              </View>
            ) : null}
          </Pressable>
        }
      />
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.greetCard}>
          <Text style={styles.greetEn}>
            {greetEn}, {worker?.name || "ASHA"}
          </Text>
          <Text style={styles.greetHi}>
            {greetHi}, {worker?.name || "ASHA"}
          </Text>
          <Text style={styles.village}>
            {worker?.village || "—"} • {worker?.block || "—"}
          </Text>
          <BentoStatGrid
            items={[
              { key: "s", icon: "folder-open-outline", value: surveysToday, labelHi: "सर्वे", labelEn: "Surveys", color: COLORS.primary },
              { key: "h", icon: "home-outline", value: householdCount, labelHi: "परिवार", labelEn: "Houses", color: COLORS.primary },
              { key: "a", icon: "flash-outline", value: criticalN, labelHi: "अलर्ट", labelEn: "Alerts", color: COLORS.danger },
            ]}
          />
        </View>

        <SyncPendingBanner onSyncPress={onRefresh} />

        <Text style={styles.syncMeta}>
          Last sync / आखरी सिंक: {timeAgo(lastSyncedAt)} · {isOnline ? "Online" : "Offline"}
        </Text>

        <Text style={styles.sectionHi}>त्वरित क्रियाएं</Text>
        <Text style={styles.sectionEn}>Quick Actions</Text>
        <View style={styles.grid}>
          {[
            { hi: "परिवार पंजीकरण", en: "Register Household", icon: "person-add-outline", route: "/(tabs)/patients/add" },
            { hi: "सर्वेक्षण भरें", en: "Fill Survey", icon: "document-text-outline", route: "/(tabs)/patients" },
            { hi: "फॉलो-अप्स", en: "Follow-Ups", icon: "calendar-outline", route: "/(tabs)/followups", badge: overdueFu },
            { hi: "मेरा प्रोत्साहन", en: "My Incentives", icon: "wallet-outline", route: "/(tabs)/earnings" },
            { hi: "सिंक और सेटिंग", en: "Sync & Settings", icon: "settings-outline", route: "/(tabs)/sync" },
            { hi: "एमसीपी कार्ड", en: "MCP Card", icon: "medkit-outline", route: "/(tabs)/mcp" },
          ].map((q) => (
            <Pressable key={q.en} style={styles.qCard} onPress={() => router.push(q.route)}>
              <Ionicons name={q.icon} size={32} color={COLORS.primary} />
              <Text style={styles.qHi}>{q.hi}</Text>
              <Text style={styles.qEn}>{q.en}</Text>
              {q.badge > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeTxt}>{q.badge}</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.syncRow} onPress={onRefresh} disabled={isSyncing}>
          <Ionicons name="refresh" size={22} color={COLORS.primary} />
          <Text style={styles.syncRowTxt}>{isSyncing ? "सिंक हो रहा है…" : "अभी सिंक करें / Sync now"}</Text>
        </Pressable>

        <Text style={styles.disclaimer}>
          Incentives are activity and outcome based — no per-patient brokerage. / प्रोत्साहन गतिविधि पर आधारित।
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  scrollContainer: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 32 },
  notifBtn: { minWidth: 52, minHeight: 52, alignItems: "center", justifyContent: "center" },
  notifBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: COLORS.danger,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  notifBadgeTxt: { color: "#fff", fontSize: 9, fontWeight: "800" },
  greetCard: {
    margin: 16,
    backgroundColor: COLORS.greetingCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.greetingBorder,
    padding: 16,
  },
  greetEn: { fontSize: 16, fontWeight: "800", color: COLORS.primary },
  greetHi: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  village: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, marginBottom: 12 },
  syncMeta: { paddingHorizontal: 16, fontSize: 11, color: COLORS.textHint, marginBottom: 8 },
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
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 52,
  },
  syncRowTxt: { fontWeight: "700", color: COLORS.primary },
  disclaimer: { margin: 16, fontSize: 11, color: COLORS.textSecondary, lineHeight: 16 },
});
