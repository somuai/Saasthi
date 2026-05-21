import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useDatabase } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import { useSelector } from "react-redux";
import { GovtHeader } from "../../components/GovtHeader";
import { LoadingState } from "../../components/LoadingState";
import { ErrorState } from "../../components/ErrorState";
import { COLORS } from "../../constants/colors";
import { FEATURES } from "../../constants/featureFlags";
import { firstDayOfMonthYmd, lastDayOfMonthYmd } from "../../utils/dateHelpers";
import { tapTargetMin } from "../../constants/typography";

const ACTION_LABELS = {
  SURVEY_COMPLETE: { hi: "सर्वे पूर्ण", en: "Survey completed" },
  FOLLOWUP_COMPLETE: { hi: "फॉलो-अप पूर्ण", en: "Follow-up done" },
  survey_complete: { hi: "सर्वे पूर्ण", en: "Survey completed" },
  followup_complete: { hi: "फॉलो-अप पूर्ण", en: "Follow-up done" },
  anc_visit: { hi: "ANC विज़िट", en: "ANC visit" },
  immunization: { hi: "टीकाकरण", en: "Immunization" },
  referral_closed: { hi: "रेफरल बंद", en: "Referral closed" },
};

const CHIP_BG = {
  pending: COLORS.incentivePending,
  approved: COLORS.incentiveApproved,
  paid: COLORS.incentivePaid,
};

const MONTH_TARGET_PTS = 120;

export default function EarningsScreen() {
  const database = useDatabase();
  const worker = useSelector((s) => s.auth.workerData);
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let sub;
    try {
      const start = firstDayOfMonthYmd();
      const end = lastDayOfMonthYmd();
      const q = database.collections
        .get("incentive_records")
        .query(Q.where("period_date", Q.gte(start)), Q.where("period_date", Q.lte(end)), Q.sortBy("created_at", Q.desc));
      sub = q.observe().subscribe((data) => {
        setRows(data);
        setLoaded(true);
      });
    } catch (e) {
      setError(e);
      setLoaded(true);
    }
    return () => sub?.unsubscribe();
  }, [database]);

  const totalPts = rows.reduce((a, r) => a + (r.points || 0), 0);
  const totalInr = rows.reduce((a, r) => a + (r.amountInr || 0), 0);
  const progress = Math.min(100, Math.round((totalPts / MONTH_TARGET_PTS) * 100));

  const stats = useMemo(() => {
    const byAction = {};
    for (const r of rows) {
      const k = r.actionType || "other";
      byAction[k] = (byAction[k] || 0) + (r.points || 0);
    }
    return Object.entries(byAction)
      .map(([actionType, points]) => ({ actionType, points }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 4);
  }, [rows]);

  function chipState(item) {
    if (item.isApproved) return "approved";
    return "pending";
  }

  if (error) {
    return <ErrorState message="Failed to load earnings." />;
  }

  if (!loaded && rows.length === 0) {
    return <LoadingState />;
  }

  return (
    <View style={styles.page}>
      <GovtHeader titleHi="मेरा प्रोत्साहन" title="Incentive Ledger" showSync />
      <View style={styles.wallet}>
        <Text style={styles.wHi}>ASHA — {worker?.name || "—"}</Text>
        <Text style={styles.wAmt}>₹{totalInr.toFixed(0)}</Text>
        <Text style={styles.wSub}>इस माह / This month</Text>
        <Text style={styles.pts}>{totalPts} अंक / points</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.target}>
          लक्ष्य {MONTH_TARGET_PTS} अंक — {progress}% / Target {MONTH_TARGET_PTS} pts
        </Text>
        {FEATURES.PDF_PAYSLIP && (
          <Pressable style={styles.pdfBtn} onPress={() => {}} disabled>
            <Text style={styles.pdfTxt}>PDF — जल्द उपलब्ध / Coming soon</Text>
          </Pressable>
        )}
      </View>

      {stats.length > 0 ? (
        <View style={styles.statsRow}>
          {stats.map((s) => {
            const lbl = ACTION_LABELS[s.actionType] || { hi: s.actionType, en: s.actionType };
            return (
              <View key={s.actionType} style={[styles.statChip, { backgroundColor: COLORS.incentiveApproved }]}>
                <Text style={styles.statPts}>+{s.points}</Text>
                <Text style={styles.statHi}>{lbl.hi}</Text>
              </View>
            );
          })}
        </View>
      ) : null}

      <Text style={styles.h}>अर्जन इतिहास / History</Text>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        style={styles.flatList}
        contentContainerStyle={styles.flatListContent}
        ListEmptyComponent={<Text style={styles.empty}>इस माह कोई रिकॉर्ड नहीं</Text>}
        renderItem={({ item }) => {
          const lbl = ACTION_LABELS[item.actionType] || { hi: item.actionType, en: item.actionType };
          const state = chipState(item);
          return (
            <View style={[styles.line, { backgroundColor: CHIP_BG[state] || COLORS.card }]}>
              <View style={styles.lineTop}>
                <Text style={styles.action}>{lbl.hi}</Text>
                <View style={[styles.stateChip, { borderColor: COLORS.border }]}>
                  <Text style={styles.stateTxt}>{item.isApproved ? "Approved" : "Pending"}</Text>
                </View>
              </View>
              <Text style={styles.actionEn}>{lbl.en}</Text>
              <Text style={styles.meta}>+{item.points} pts · ₹{item.amountInr}</Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  flatList: { flex: 1 },
  flatListContent: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 100 },
  wallet: {
    margin: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
  },
  wHi: { color: "rgba(255,255,255,0.75)", fontSize: 12 },
  wAmt: { color: "#fff", fontSize: 44, fontWeight: "900", marginTop: 8 },
  wSub: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 4 },
  pts: { color: COLORS.accent, fontSize: 18, fontWeight: "800", marginTop: 12 },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginTop: 14,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: COLORS.accent, borderRadius: 4 },
  target: { color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 8 },
  pdfBtn: {
    marginTop: 14,
    minHeight: tapTargetMin,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.7,
  },
  pdfTxt: { color: "#fff", fontSize: 12, fontWeight: "700" },
  statsRow: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, gap: 8, marginBottom: 8 },
  statChip: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: "45%",
  },
  statPts: { fontWeight: "900", color: COLORS.accent, fontSize: 16 },
  statHi: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  h: { paddingHorizontal: 16, fontWeight: "800", color: COLORS.textPrimary, marginBottom: 8 },
  line: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  lineTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  action: { fontWeight: "700", color: COLORS.textPrimary },
  actionEn: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  meta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  stateChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: COLORS.card,
  },
  stateTxt: { fontSize: 10, fontWeight: "800", color: COLORS.textSecondary },
  empty: { color: COLORS.textSecondary, textAlign: "center", marginTop: 24 },
});
