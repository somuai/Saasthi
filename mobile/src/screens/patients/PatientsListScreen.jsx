import { useCallback, useEffect, useState } from "react";
import { FlatList as RNFlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { LottieWrapper } from "../../components/LottieWrapper";
import { useRouter } from "expo-router";
import { useDatabase } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import { Ionicons } from "@expo/vector-icons";
import { GovtHeader } from "../../components/GovtHeader";
import { PatientCard } from "../../components/PatientCard";
import { LoadingState } from "../../components/LoadingState";
import { COLORS } from "../../constants/colors";
import { TAB_SCREEN_BOTTOM_PADDING } from "../../constants/layout";
import { localizePair, translateHindiText, useLocale } from "../../utils/localization";

const FILTERS = [
  { id: "all", hi: "सभी", en: "All" },
  { id: "critical", hi: "गंभीर", en: "Critical" },
  { id: "high", hi: "उच्च", en: "High" },
  { id: "pregnant", hi: "गर्भवती", en: "Pregnant" },
];

export default function PatientsListScreen() {
  const database = useDatabase();
  const router = useRouter();
  const locale = useLocale();
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

  if (patients === null) {
    return <LoadingState />;
  }

  const criticalCount = patients.filter((p) => p.riskLevel === "critical").length;
  const localize = (hi, en) => localizePair(hi, en, locale);

  return (
    <View style={styles.page}>
      <GovtHeader titleHi="परिवार सूची" title="Household List" showBack={false} showSync />
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={COLORS.textHint} style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.search}
          placeholder={localize("नाम खोजें…", "Search households…")}
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
        {FILTERS.map((c) => (
          <Pressable key={c.id} onPress={() => setFilter(c.id)} style={[styles.chip, filter === c.id && styles.chipOn]}>
            <Text style={[styles.chipTxt, filter === c.id && styles.chipTxtOn]}>{localize(c.hi, c.en)}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Text style={styles.count}>
        {patients.length} {locale === "en" ? "patients" : translateHindiText("मरीज", locale)} · {criticalCount}{" "}
        {locale === "en" ? "critical" : translateHindiText("गंभीर", locale)}
      </Text>
      <FlashList
        data={patients}
        keyExtractor={(item) => item.id}
        style={styles.flatList}
        contentContainerStyle={styles.flatListContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        estimatedItemSize={100}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <LottieWrapper name="empty_households" size={130} loop={true} style={{ marginBottom: 12 }} />
            <Text style={styles.emptyTitle}>{localize("घर दर्ज करना शुरू करें", "Start registering households")}</Text>
            <Text style={styles.emptySub}>
              {localize("पहले घर जाएं, + टैप करें और परिवार जोड़ें", "Go to your first house, tap + and add the family")}
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

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  flatList: { flex: 1 },
  flatListContent: { flexGrow: 1, paddingBottom: TAB_SCREEN_BOTTOM_PADDING },
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
  emptyContainer: { alignItems: "center", justifyContent: "center", marginTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.textPrimary, marginBottom: 6, textAlign: "center" },
  emptySub: { fontSize: 13, color: COLORS.textSecondary, textAlign: "center" },
  fab: {
    position: "absolute",
    right: 24,
    bottom: 24,
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
});
