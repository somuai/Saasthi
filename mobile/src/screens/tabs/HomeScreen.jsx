import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useDatabase } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import { useSelector, useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { McpIcon } from "../../components/McpIcon";
import { GovtHeader } from "../../components/GovtHeader";
import { BentoStatGrid } from "../../components/BentoStatGrid";
import { SyncPendingBanner } from "../../components/SyncPendingBanner";
import { LoadingState } from "../../components/LoadingState";
import { ErrorState } from "../../components/ErrorState";
import { COLORS } from "../../constants/colors";
import { TAB_SCREEN_BOTTOM_PADDING } from "../../constants/layout";
import { todayYmd, timeAgo } from "../../utils/dateHelpers";
import { syncWithServer, countPendingRecords } from "../../database/sync";
import { setPendingCount, syncStarted, syncSucceeded, syncFailed } from "../../features/sync/syncSlice";
import { signOut } from "../../features/auth/authSlice";
import { clearAuthSession } from "../../features/auth/authSession";
import { localizePair, translateHindiText, useLocale } from "../../utils/localization";
import { logger } from "../../utils/logger";
import * as Location from "expo-location";

export default function HomeScreen() {
  const router = useRouter();
  const database = useDatabase();
  const dispatch = useDispatch();
  const locale = useLocale();
  const worker = useSelector((s) => s.auth.workerData);
  const { pendingCount, lastSyncedAt, isSyncing, isOnline } = useSelector((s) => s.sync);

  const [surveysToday, setSurveysToday] = useState(null);
  const [householdCount, setHouseholdCount] = useState(null);
  const [overdueFu, setOverdueFu] = useState(null);
  const [criticalN, setCriticalN] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted" || cancelled) return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        const geo = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (cancelled) return;
        if (geo && geo.length > 0) {
          const place = geo[0];
          const locality = place.district || place.city || place.subregion || place.name || "";
          if (locality && !locality.includes("+")) {
            setCurrentLocation(locality);
          } else if (place.city) {
            setCurrentLocation(place.city);
          }
        }
      } catch (e) {
        logger.debug("[HomeScreen] Location or geocode unavailable", e?.message || e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const reload = useCallback(async () => {
    const t = todayYmd();
    setError(null);
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
      const hh = await database.collections.get("households").query(Q.where("is_deleted", false)).fetchCount();
      setHouseholdCount(hh);
      const pend = await countPendingRecords();
      dispatch(setPendingCount(pend));
    } catch (e) {
      setError(e);
    }
  }, [database, dispatch]);

  useEffect(() => {
    const sub = database.collections
      .get("patients")
      .query()
      .observe()
      .subscribe(() => {
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

  async function logout() {
    await clearAuthSession();
    dispatch(signOut());
  }

  const hour = new Date().getHours();
  let greetEn = "Good Morning";
  let greetHi = "सुप्रभात";
  let greetBn = "সুপ্রভাত";

  if (hour >= 12 && hour < 17) {
    greetEn = "Good Afternoon";
    greetHi = "शुभ दोपहर";
    greetBn = "শুভ দুপুর";
  } else if (hour >= 17 && hour < 22) {
    greetEn = "Good Evening";
    greetHi = "शुभ संध्या";
    greetBn = "শুভ সন্ধ্যা";
  } else if (hour >= 22 || hour < 4) {
    greetEn = "Good Night";
    greetHi = "शुभ रात्रि";
    greetBn = "শুভ রাত্রি";
  }

  const primaryGreet = locale === "en" ? greetEn : locale === "bn" ? greetBn : greetHi;
  const pair = (hi, en) => localizePair(hi, en, locale);
  const hiText = (hi) => (locale === "en" ? hi : translateHindiText(hi, locale));

  const homeHeader = (
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
  );

  if (error) {
    return (
      <View style={styles.page}>
        {homeHeader}
        <ErrorState message="Failed to load dashboard." onRetry={reload} />
      </View>
    );
  }

  if (surveysToday === null || householdCount === null || overdueFu === null || criticalN === null) {
    return (
      <View style={styles.page}>
        {homeHeader}
        <LoadingState />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      {homeHeader}
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.greetCard}>
          <Text style={styles.greetEn}>
            {primaryGreet}, {worker?.name || "ASHA"}
          </Text>
          {locale === "en" ? null : (
            <Text style={styles.greetHi}>
              {greetEn}, {worker?.name || "ASHA"}
            </Text>
          )}
          <View style={styles.locationContainer}>
            <Ionicons name="location" size={14} color={COLORS.primary} style={styles.locationIcon} />
            <Text style={styles.village} numberOfLines={1}>
              {currentLocation || `${worker?.village || "—"} • ${worker?.block || "—"}`}
            </Text>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <BentoStatGrid
            items={[
              { key: "s", icon: "folder-open-outline", value: surveysToday, labelHi: "सर्वे", labelEn: "Surveys", color: COLORS.primary },
              { key: "h", icon: "home-outline", value: householdCount, labelHi: "परिवार", labelEn: "Houses", color: COLORS.primary },
              { key: "a", icon: "flash-outline", value: criticalN, labelHi: "अलर्ट", labelEn: "Alerts", color: COLORS.danger },
            ]}
          />
        </View>

        <SyncPendingBanner onSyncPress={onRefresh} />

        {lastSyncedAt && Date.now() - new Date(lastSyncedAt).getTime() > 3600000 && pendingCount > 0 ? (
          <View style={styles.staleBanner}>
            <Ionicons name="warning-outline" size={16} color="#fff" />
            <Text style={styles.staleTxt}>
              {pair("सिंक नहीं हुआ", "Not synced")} — {timeAgo(lastSyncedAt, locale)}
            </Text>
            <Pressable onPress={onRefresh} style={styles.staleBtn}>
              <Text style={styles.staleBtnTxt}>Sync</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.syncMeta}>
          {pair("आखरी सिंक", "Last sync")}: {timeAgo(lastSyncedAt, locale)} · {isOnline ? "Online" : "Offline"}
        </Text>

        <Text style={styles.sectionHi}>{locale === "en" ? "Quick Actions" : hiText("त्वरित क्रियाएं")}</Text>
        {locale === "en" ? null : <Text style={styles.sectionEn}>Quick Actions</Text>}
        <View style={styles.grid}>
          {[
            { hi: "परिवार पंजीकरण", en: "Register Household", icon: "person-add-outline", route: "/(tabs)/patients/add" },
            { hi: "सर्वेक्षण भरें", en: "Fill Survey", icon: "document-text-outline", route: "/(tabs)/patients" },
            { hi: "फॉलो-अप्स", en: "Follow-Ups", icon: "calendar-outline", route: "/(tabs)/followups", badge: overdueFu },
            { hi: "मेरा प्रोत्साहन", en: "My Incentives", icon: "wallet-outline", route: "/(tabs)/earnings" },
            { hi: "सिंक और सेटिंग", en: "Sync & Settings", icon: "settings-outline", route: "/(tabs)/sync" },
            { hi: "एमसीपी कार्ड", en: "MCP Card", icon: "medkit-outline", customIcon: McpIcon, route: "/(tabs)/mcp" },
          ].map((q) => (
            <Pressable key={q.en} style={styles.qCard} onPress={() => router.push(q.route)}>
              {q.customIcon ? (
                <q.customIcon size={32} color={COLORS.primary} />
              ) : (
                <Ionicons name={q.icon} size={32} color={COLORS.primary} />
              )}
              <Text style={styles.qHi}>{locale === "en" ? q.en : hiText(q.hi)}</Text>
              {locale === "en" ? null : <Text style={styles.qEn}>{q.en}</Text>}
              {q.badge > 0 ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeTxt}>{q.badge}</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.logoutRow} onPress={logout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.danger} />
          <Text style={styles.logoutTxt}>{pair("साइन आउट", "Sign Out")}</Text>
        </Pressable>

        <Pressable style={styles.syncRow} onPress={onRefresh} disabled={isSyncing}>
          <Ionicons name="refresh" size={22} color={COLORS.primary} />
          <Text style={styles.syncRowTxt}>{isSyncing ? hiText("सिंक हो रहा है…") : pair("अभी सिंक करें", "Sync now")}</Text>
        </Pressable>

        <Text style={styles.disclaimer}>
          {pair("प्रोत्साहन गतिविधि पर आधारित।", "Incentives are activity and outcome based — no per-patient brokerage.")}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  scrollContainer: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: TAB_SCREEN_BOTTOM_PADDING },
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
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 18,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  greetEn: { fontSize: 18, fontWeight: "900", color: COLORS.primary },
  greetHi: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary, marginTop: 2 },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 0,
  },
  locationIcon: {
    marginRight: 4,
  },
  village: { fontSize: 12, color: COLORS.textSecondary, flexShrink: 1 },
  statsContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
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
  staleBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.danger,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 8,
  },
  staleTxt: { color: "#fff", fontSize: 12, fontWeight: "700", flex: 1 },
  staleBtn: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  staleBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 12 },
  logoutRow: {
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
  logoutTxt: { fontWeight: "700", color: COLORS.danger },
  disclaimer: { margin: 16, fontSize: 11, color: COLORS.textSecondary, lineHeight: 16 },
});
