import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useDatabase } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import { useSelector } from "react-redux";
import { GovtHeader } from "../../components/GovtHeader";
import { COLORS } from "../../constants/colors";
import { firstDayOfMonthYmd, lastDayOfMonthYmd } from "../../utils/dateHelpers";

export default function EarningsScreen() {
  const database = useDatabase();
  const worker = useSelector((s) => s.auth.workerData);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const start = firstDayOfMonthYmd();
    const end = lastDayOfMonthYmd();
    const q = database.collections
      .get("incentive_records")
      .query(Q.where("period_date", Q.gte(start)), Q.where("period_date", Q.lte(end)), Q.sortBy("created_at", Q.desc));
    const sub = q.observe().subscribe(setRows);
    return () => sub.unsubscribe();
  }, [database]);

  const totalPts = rows.reduce((a, r) => a + (r.points || 0), 0);
  const totalInr = rows.reduce((a, r) => a + (r.amountInr || 0), 0);

  return (
    <View style={styles.page}>
      <GovtHeader titleHi="मेरी कमाई" title="My Earnings" showSync />
      <View style={styles.wallet}>
        <Text style={styles.wHi}>ASHA — {worker?.name || "—"}</Text>
        <Text style={styles.wAmt}>₹{totalInr.toFixed(0)}</Text>
        <Text style={styles.wSub}>इस माह / This month</Text>
        <Text style={styles.pts}>{totalPts} अंक / points</Text>
      </View>
      <Text style={styles.h}>अर्जन इतिहास / History</Text>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
        ListEmptyComponent={<Text style={styles.empty}>इस माह कोई रिकॉर्ड नहीं</Text>}
        renderItem={({ item }) => (
          <View style={styles.line}>
            <Text style={styles.action}>{item.actionType}</Text>
            <Text style={styles.meta}>+{item.points} pts · ₹{item.amountInr}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
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
  h: { paddingHorizontal: 16, fontWeight: "800", color: COLORS.textPrimary, marginBottom: 8 },
  line: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  action: { fontWeight: "700", color: COLORS.textPrimary },
  meta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  empty: { color: COLORS.textSecondary, textAlign: "center", marginTop: 24 },
});
