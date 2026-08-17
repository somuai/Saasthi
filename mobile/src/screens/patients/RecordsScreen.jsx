import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { LottieWrapper } from "../../components/LottieWrapper";
import { useRouter } from "expo-router";
import { useDatabase } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import { Ionicons } from "@expo/vector-icons";
import { translateHindiText, useLocale } from "../../utils/localization";
import { useDispatch } from "react-redux";
import { GovtHeader } from "../../components/GovtHeader";
import { PatientCard } from "../../components/PatientCard";
import { GovtButton } from "../../components/GovtButton";
import { LoadingState } from "../../components/LoadingState";
import { ErrorState } from "../../components/ErrorState";
import { COLORS } from "../../constants/colors";
import { TAB_SCREEN_BOTTOM_PADDING } from "../../constants/layout";
import { tapTargetMin } from "../../constants/typography";
import { todayYmd } from "../../utils/dateHelpers";
import { incrementPendingCount } from "../../features/sync/syncSlice";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TABS = [
  { id: "patients", hi: "मरीज सूची", en: "Patients" },
  { id: "followups", hi: "फॉलो-अप", en: "Follow-ups" },
];

const PATIENT_FILTERS = [
  { id: "all", hi: "सभी", en: "All" },
  { id: "critical", hi: "गंभीर", en: "Critical" },
  { id: "high", hi: "उच्च", en: "High" },
  { id: "pregnant", hi: "गर्भवती", en: "Pregnant" },
];

function calendarDays(centerDate = new Date(), span = 35) {
  const start = new Date(centerDate);
  start.setDate(start.getDate() - Math.floor(span / 2));
  return Array.from({ length: span }, (_, i) => {
    const x = new Date(start);
    x.setDate(start.getDate() + i);
    return x.toISOString().slice(0, 10);
  });
}

/* ───────── Patients Sub-tab ───────── */
function PatientsTab() {
  const database = useDatabase();
  const router = useRouter();
  const locale = useLocale();
  const hiText = (hi) => (locale === "en" ? hi : translateHindiText(hi, locale));
  const [patients, setPatients] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [filter, setFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  const buildQuery = useCallback(() => {
    const conditions = [Q.where("is_deleted", false)];
    if (filter === "critical") conditions.push(Q.where("risk_level", "critical"));
    if (filter === "high") conditions.push(Q.where("risk_level", "high"));
    if (filter === "pregnant") conditions.push(Q.where("is_pregnant", true));
    if (searchText.length > 2) {
      const safe = searchText.replace(/%/g, "").replace(/_/g, "");
      conditions.push(Q.where("name", Q.like(`%${safe}%`)));
    }
    return database.collections.get("patients").query(...conditions, Q.sortBy("risk_score", Q.desc));
  }, [database, filter, searchText]);

  useEffect(() => {
    const query = buildQuery();
    const sub = query.observe().subscribe(setPatients);
    return () => sub.unsubscribe();
  }, [buildQuery]);

  async function onRefresh() {
    setRefreshing(true);
    const query = buildQuery();
    const list = await query.fetch();
    setPatients(list);
    setRefreshing(false);
  }

  if (patients === null) return <LoadingState />;

  const criticalCount = patients.filter((p) => p.riskLevel === "critical").length;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={COLORS.textHint} style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.search}
          placeholder={hiText("नाम खोजें… / Search households…")}
          placeholderTextColor={COLORS.textHint}
          value={searchText}
          onChangeText={setSearchText}
        />
        {searchText ? (
          <Pressable onPress={() => setSearchText("")} accessibilityLabel="Clear search">
            <Ionicons name="close-circle" size={20} color={COLORS.textHint} style={{ marginRight: 12 }} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {PATIENT_FILTERS.map((c) => (
          <Pressable key={c.id} onPress={() => setFilter(c.id)} style={[styles.chip, filter === c.id && styles.chipOn]}>
            <Text style={[styles.chipTxt, filter === c.id && styles.chipTxtOn]}>
              {hiText(c.hi)} / {c.en}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={styles.count}>
        {patients.length} {hiText("मरीज")} · {criticalCount} {hiText("गंभीर")}
      </Text>
      <FlatList
        data={patients}
        keyExtractor={(item) => item.id}
        style={styles.flatList}
        contentContainerStyle={styles.flatListContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={{ alignItems: "center", justifyContent: "center", marginTop: 40, paddingHorizontal: 32 }}>
            <LottieWrapper name="empty_households" size={130} loop={true} style={{ marginBottom: 12 }} />
            <Text style={{ fontSize: 16, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 6, textAlign: "center" }}>
              {hiText("घर दर्ज करना शुरू करें / Start registering households")}
            </Text>
            <Text style={{ fontSize: 13, color: COLORS.textSecondary, textAlign: "center" }}>
              {hiText("पहले घर जाएं, + टैप करें और परिवार जोड़ें / Go to your first house, tap + and add the family")}
            </Text>
          </View>
        }
        renderItem={({ item }) => <PatientCard patient={item} />}
      />
      <Pressable style={styles.fab} onPress={() => router.push("/(tabs)/patients/add")} accessibilityLabel="Add patient">
        <Ionicons name="add" size={26} color="#fff" />
      </Pressable>
    </View>
  );
}

/* ───────── Follow-ups Sub-tab ───────── */
function FollowupsTab() {
  const database = useDatabase();
  const dispatch = useDispatch();
  const locale = useLocale();
  const hiText = (hi) => (locale === "en" ? hi : translateHindiText(hi, locale));
  const [rows, setRows] = useState(null);
  const [patients, setPatients] = useState(null);
  const [completingId, setCompletingId] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState(todayYmd());
  const days = useMemo(() => calendarDays(new Date(), 35), []);
  const [showCompleteOverlay, setShowCompleteOverlay] = useState(false);

  const setupObservers = useCallback(() => {
    let subs = [];
    setError(null);
    try {
      const q = database.collections
        .get("follow_ups")
        .query(Q.where("is_completed", false), Q.where("is_deleted", false), Q.sortBy("due_date", Q.asc));
      const sub1 = q.observe().subscribe(setRows);
      subs.push(sub1);

      const pq = database.collections.get("patients").query(Q.where("is_deleted", false));
      const sub2 = pq.observe().subscribe((list) => {
        const map = {};
        list.forEach((p) => {
          map[p.id] = p;
        });
        setPatients(map);
      });
      subs.push(sub2);
    } catch (e) {
      setError(e);
    }
    return () => subs.forEach((s) => s.unsubscribe());
  }, [database]);

  useEffect(() => {
    return setupObservers();
  }, [setupObservers]);

  if (error) {
    return <ErrorState message="Failed to load follow-ups." onRetry={setupObservers} />;
  }

  if (rows === null || patients === null) return <LoadingState />;

  const filtered = rows.filter((r) => r.dueDate === selectedDay);
  const today = todayYmd();
  const overdueTotal = rows.filter((r) => r.dueDate < today).length;
  const todayTotal = rows.filter((r) => r.dueDate === today).length;

  async function onRefresh() {
    setRefreshing(true);
    const cleanup = setupObservers();
    await new Promise((r) => setTimeout(r, 300));
    setRefreshing(false);
    return cleanup;
  }

  async function markDone(item) {
    setCompletingId(item.id);
    const now = Date.now();
    const day = todayYmd();
    try {
      await database.write(async () => {
        await item.update((f) => {
          f.isCompleted = true;
          f.completedDate = day;
          f.isOverdue = item.dueDate < day;
          f.outcome = "improved";
          f.incentiveAwarded = true;
          f.isSynced = false;
          f.updatedAt = now;
        });
        await database.collections.get("incentive_records").create((ir) => {
          ir.actionType = "FOLLOWUP_COMPLETE";
          ir.patientId = item.patientId;
          ir.referenceId = item.id;
          ir.points = 5;
          ir.amountInr = 1;
          ir.periodDate = day;
          ir.isApproved = false;
          ir.isSynced = false;
          ir.isDeleted = false;
          ir.isMock = false;
          ir.createdAt = now;
          ir.updatedAt = now;
        });
      });
      dispatch(incrementPendingCount(2));
      setShowCompleteOverlay(true);
      setTimeout(() => setShowCompleteOverlay(false), 2500);
    } finally {
      setCompletingId(null);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statN}>{todayTotal}</Text>
          <Text style={styles.statL}>{hiText("आज / Today")}</Text>
        </View>
        <View style={[styles.statBox, styles.statDanger]}>
          <Text style={[styles.statN, { color: COLORS.danger }]}>{overdueTotal}</Text>
          <Text style={styles.statL}>{hiText("देर / Overdue")}</Text>
        </View>
      </View>
      <FlatList
        horizontal
        data={days}
        keyExtractor={(d) => d}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        renderItem={({ item: d }) => {
          const cnt = rows.filter((r) => r.dueDate === d).length;
          const on = d === selectedDay;
          const overdue = d < today && cnt > 0;
          return (
            <Pressable style={[styles.dayChip, on && styles.dayChipOn, overdue && styles.dayChipLate]} onPress={() => setSelectedDay(d)}>
              <Text style={[styles.dayTxt, on && styles.dayTxtOn]}>{d.slice(8)}</Text>
              <Text style={[styles.dayMo, on && styles.dayTxtOn]}>{d.slice(5, 7)}</Text>
              {cnt > 0 ? <View style={styles.dot} /> : null}
            </Pressable>
          );
        }}
      />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        style={styles.flatList}
        contentContainerStyle={styles.flatListContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {hiText("इस दिन कोई फॉलो-अप नहीं")} / No follow-ups on {selectedDay}
          </Text>
        }
        renderItem={({ item }) => {
          const p = patients[item.patientId];
          const overdue = item.dueDate < today;
          return (
            <View style={[styles.row, overdue && styles.rowLate]}>
              <Text style={styles.name}>{p?.name || "Patient"}</Text>
              <Text style={styles.due}>
                Due / {hiText("देय")}: {item.dueDate}
              </Text>
              <Text style={styles.type}>{item.followType}</Text>
              {overdue ? (
                <View style={styles.overdueBadge}>
                  <Text style={styles.overdueTxt}>OVERDUE / {hiText("देर से")}</Text>
                </View>
              ) : null}
              <GovtButton
                titleHi="पूर्ण"
                titleEn="Mark done"
                onPress={() => markDone(item)}
                loading={completingId === item.id}
                variant="secondary"
              />
            </View>
          );
        }}
      />
      {showCompleteOverlay && (
        <View
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(255,255,255,0.95)",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
          }}
        >
          <LottieWrapper name="visit_complete" size={150} loop={false} autoPlay={true} />
          <Text style={{ marginTop: 12, fontWeight: "900", fontSize: 20, color: COLORS.primary }}>Visit Completed!</Text>
          <Text style={{ fontSize: 13, color: COLORS.textSecondary }}>Incentive recorded</Text>
        </View>
      )}
    </View>
  );
}

/* ───────── Main Records Screen ───────── */
export default function RecordsScreen() {
  const locale = useLocale();
  const hiText = (hi) => (locale === "en" ? hi : translateHindiText(hi, locale));
  const [activeTab, setActiveTab] = useState("patients");
  const slideAnim = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get("window").width;

  function switchTab(tabId) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setActiveTab(tabId);
    Animated.spring(slideAnim, {
      toValue: tabId === "patients" ? 0 : 1,
      useNativeDriver: false,
      friction: 20,
      tension: 80,
    }).start();
  }

  const indicatorLeft = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, screenWidth / 2],
  });

  return (
    <View style={styles.page}>
      <GovtHeader titleHi="रिकॉर्ड" title="Records" showBack={false} showSync />

      {/* ── Top Tab Switcher ── */}
      <View style={styles.topTabs}>
        {TABS.map((t) => {
          const active = activeTab === t.id;
          return (
            <Pressable key={t.id} style={styles.topTab} onPress={() => switchTab(t.id)} accessibilityRole="tab">
              <Text style={[styles.topTabHi, active && styles.topTabActive]}>{hiText(t.hi)}</Text>
              <Text style={[styles.topTabEn, active && styles.topTabActiveEn]}>{t.en}</Text>
            </Pressable>
          );
        })}
        <Animated.View style={[styles.indicator, { left: indicatorLeft, width: screenWidth / 2 }]} />
      </View>

      {/* ── Tab Content ── */}
      {activeTab === "patients" ? <PatientsTab /> : <FollowupsTab />}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  /* Top Tab Switcher */
  topTabs: {
    flexDirection: "row",
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    position: "relative",
  },
  topTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    minHeight: tapTargetMin,
    justifyContent: "center",
  },
  topTabHi: { fontSize: 13, fontWeight: "800", color: COLORS.textSecondary },
  topTabEn: { fontSize: 10, color: COLORS.textHint, marginTop: 1 },
  topTabActive: { color: COLORS.primary },
  topTabActiveEn: { color: COLORS.primary },
  indicator: {
    position: "absolute",
    bottom: 0,
    height: 3,
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  /* Patients tab */
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 8,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  search: { flex: 1, paddingHorizontal: 8, fontSize: 15, color: COLORS.textPrimary },
  chips: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  chip: {
    paddingHorizontal: 16,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    justifyContent: "center",
    marginRight: 8,
  },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipTxt: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "600" },
  chipTxtOn: { color: "#fff" },
  count: { paddingHorizontal: 16, fontSize: 12, color: COLORS.textSecondary, marginBottom: 8 },
  flatList: { flex: 1 },
  flatListContent: { flexGrow: 1, padding: 16, paddingBottom: TAB_SCREEN_BOTTOM_PADDING },
  empty: { textAlign: "center", marginTop: 40, color: COLORS.textSecondary, paddingHorizontal: 24 },
  fab: {
    position: "absolute",
    right: 24,
    bottom: 96,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  /* Follow-ups tab */
  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 8 },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  statDanger: { borderColor: COLORS.danger },
  statN: { fontSize: 22, fontWeight: "900", color: COLORS.primary },
  statL: { fontSize: 11, color: COLORS.textSecondary, marginTop: 4 },
  strip: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  dayChip: {
    width: 56,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    minHeight: tapTargetMin,
    justifyContent: "center",
  },
  dayChipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayChipLate: { borderColor: COLORS.danger },
  dayTxt: { fontSize: 14, fontWeight: "800", color: COLORS.textPrimary },
  dayMo: { fontSize: 10, color: COLORS.textSecondary },
  dayTxtOn: { color: "#fff" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.accent, marginTop: 4 },
  row: {
    padding: 14,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
    gap: 6,
  },
  rowLate: { borderLeftColor: COLORS.danger },
  name: { fontWeight: "800", color: COLORS.textPrimary, fontSize: 15 },
  due: { fontWeight: "700", color: COLORS.textPrimary },
  type: { color: COLORS.textSecondary },
  overdueBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#FFEBEE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  overdueTxt: { color: COLORS.danger, fontSize: 10, fontWeight: "800" },
});
