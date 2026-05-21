import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useDatabase } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import { useDispatch } from "react-redux";
import { GovtHeader } from "../../components/GovtHeader";
import { GovtButton } from "../../components/GovtButton";
import { LoadingState } from "../../components/LoadingState";
import { ErrorState } from "../../components/ErrorState";
import { COLORS } from "../../constants/colors";
import { todayYmd } from "../../utils/dateHelpers";
import { incrementPendingCount } from "../../features/sync/syncSlice";
import { tapTargetMin } from "../../constants/typography";

function calendarDays(centerDate = new Date(), span = 35) {
  const start = new Date(centerDate);
  start.setDate(start.getDate() - Math.floor(span / 2));
  return Array.from({ length: span }, (_, i) => {
    const x = new Date(start);
    x.setDate(start.getDate() + i);
    return x.toISOString().slice(0, 10);
  });
}

export default function FollowupsScreen() {
  const database = useDatabase();
  const dispatch = useDispatch();
  const [rows, setRows] = useState(null);
  const [patients, setPatients] = useState(null);
  const [completingId, setCompletingId] = useState(null);
  const [error, setError] = useState(null);
  const [selectedDay, setSelectedDay] = useState(todayYmd());
  const days = useMemo(() => calendarDays(new Date(), 35), []);

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

  if (rows === null || patients === null) {
    return <LoadingState />;
  }

  const filtered = useMemo(() => rows.filter((r) => r.dueDate === selectedDay), [rows, selectedDay]);
  const today = todayYmd();
  const overdueTotal = rows.filter((r) => r.dueDate < today).length;
  const todayTotal = rows.filter((r) => r.dueDate === today).length;

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
    } finally {
      setCompletingId(null);
    }
  }

  return (
    <View style={styles.page}>
      <GovtHeader titleHi="फॉलो-अप" title="Follow-ups" showSync />
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statN}>{todayTotal}</Text>
          <Text style={styles.statL}>आज / Today</Text>
        </View>
        <View style={[styles.statBox, styles.statDanger]}>
          <Text style={[styles.statN, { color: COLORS.danger }]}>{overdueTotal}</Text>
          <Text style={styles.statL}>देर / Overdue</Text>
        </View>
      </View>
      <FlatList
        horizontal
        data={days}
        keyExtractor={(d) => d}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        renderItem={({ item: d }) => {
          const count = rows.filter((r) => r.dueDate === d).length;
          const on = d === selectedDay;
          const overdue = d < today && count > 0;
          return (
            <Pressable
              style={[styles.dayChip, on && styles.dayChipOn, overdue && styles.dayChipLate]}
              onPress={() => setSelectedDay(d)}
            >
              <Text style={[styles.dayTxt, on && styles.dayTxtOn]}>{d.slice(8)}</Text>
              <Text style={[styles.dayMo, on && styles.dayTxtOn]}>{d.slice(5, 7)}</Text>
              {count > 0 ? <View style={styles.dot} /> : null}
            </Pressable>
          );
        }}
      />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        style={styles.flatList}
        contentContainerStyle={styles.flatListContent}
        ListEmptyComponent={
          <Text style={styles.empty}>इस दिन कोई फॉलो-अप नहीं / No follow-ups on {selectedDay}</Text>
        }
        renderItem={({ item }) => {
          const p = patients[item.patientId];
          const overdue = item.dueDate < today;
          return (
            <View style={[styles.row, overdue && styles.rowLate]}>
              <Text style={styles.name}>{p?.name || "Patient"}</Text>
              <Text style={styles.due}>Due / देय: {item.dueDate}</Text>
              <Text style={styles.type}>{item.followType}</Text>
              {overdue ? (
                <View style={styles.overdueBadge}>
                  <Text style={styles.overdueTxt}>OVERDUE / देर से</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  flatList: { flex: 1 },
  flatListContent: { flexGrow: 1, padding: 16, paddingBottom: 100 },
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
  empty: { textAlign: "center", marginTop: 40, color: COLORS.textSecondary },
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
