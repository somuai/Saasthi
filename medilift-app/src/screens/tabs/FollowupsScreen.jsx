import { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useDatabase } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import { GovtHeader } from "../../components/GovtHeader";
import { COLORS } from "../../constants/colors";
import { todayYmd } from "../../utils/dateHelpers";

export default function FollowupsScreen() {
  const database = useDatabase();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const q = database.collections
      .get("follow_ups")
      .query(Q.where("is_completed", false), Q.where("is_deleted", false), Q.sortBy("due_date", Q.asc));
    const sub = q.observe().subscribe(setRows);
    return () => sub.unsubscribe();
  }, [database]);

  return (
    <View style={styles.page}>
      <GovtHeader titleHi="फॉलो-अप" title="Follow-ups" showSync />
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        ListEmptyComponent={<Text style={styles.empty}>कोई फॉलो-अप नहीं / No open follow-ups</Text>}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.due}>Due / देय: {item.dueDate}</Text>
            <Text style={styles.type}>{item.followType}</Text>
            {item.dueDate < todayYmd() ? <Text style={styles.late}>Overdue / देर से</Text> : null}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  empty: { textAlign: "center", marginTop: 40, color: COLORS.textSecondary },
  row: {
    padding: 14,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.accent,
  },
  due: { fontWeight: "800", color: COLORS.textPrimary },
  type: { color: COLORS.textSecondary, marginTop: 4 },
  late: { color: COLORS.danger, marginTop: 6, fontWeight: "700" },
});
