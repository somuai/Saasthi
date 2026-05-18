import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useDatabase } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import { useDispatch } from "react-redux";
import { GovtHeader } from "../../components/GovtHeader";
import { GovtButton } from "../../components/GovtButton";
import { COLORS } from "../../constants/colors";
import { todayYmd } from "../../utils/dateHelpers";
import { incrementPendingCount } from "../../features/sync/syncSlice";

function weekDays(baseDate = new Date()) {
  const d = new Date(baseDate);
  const day = d.getDay();
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(monday);
    x.setDate(monday.getDate() + i);
    return x.toISOString().slice(0, 10);
  });
}

export default function FollowupsScreen() {
  const database = useDatabase();
  const dispatch = useDispatch();
  const [rows, setRows] = useState([]);
  const [patients, setPatients] = useState({});
  const [completingId, setCompletingId] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(todayYmd());

  const days = useMemo(() => {
    const base = new Date();
    base.setDate(base.getDate() + weekOffset * 7);
    return weekDays(base);
  }, [weekOffset]);

  useEffect(() => {
    if (!days.includes(selectedDay)) setSelectedDay(days[0]);
  }, [days, selectedDay]);

  useEffect(() => {
    const q = database.collections
      .get("follow_ups")
      .query(Q.where("is_completed", false), Q.where("is_deleted", false), Q.sortBy("due_date", Q.asc));
    const sub = q.observe().subscribe(setRows);
    return () => sub.unsubscribe();
  }, [database]);

  useEffect(() => {
    const pq = database.collections.get("patients").query(Q.where("is_deleted", false));
    const sub = pq.observe().subscribe((list) => {
      const map = {};
      list.forEach((p) => {
        map[p.id] = p;
      });
      setPatients(map);
    });
    return () => sub.unsubscribe();
  }, [database]);

  const filtered = useMemo(() => rows.filter((r) => r.dueDate === selectedDay), [rows, selectedDay]);

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

  const today = todayYmd();

  return (
    <View style={styles.page}>
      <GovtHeader titleHi="फॉलो-अप" title="Follow-ups" showSync />
      <View style={styles.weekNav}>
        <Pressable onPress={() => setWeekOffset((w) => w - 1)} style={styles.weekBtn}>
          <Text style={styles.weekBtnTxt}>◀</Text>
        </Pressable>
        <Text style={styles.weekLabel}>सप्ताह / Week</Text>
        <Pressable onPress={() => setWeekOffset((w) => w + 1)} style={styles.weekBtn}>
          <Text style={styles.weekBtnTxt}>▶</Text>
        </Pressable>
      </View>
      <View style={styles.strip}>
        {days.map((d) => {
          const count = rows.filter((r) => r.dueDate === d).length;
          const overdue = d < today;
          const on = d === selectedDay;
          return (
            <Pressable
              key={d}
              style={[styles.dayChip, on && styles.dayChipOn, overdue && count > 0 && styles.dayChipLate]}
              onPress={() => setSelectedDay(d)}
            >
              <Text style={[styles.dayTxt, on && styles.dayTxtOn]}>{d.slice(5)}</Text>
              {count > 0 ? <Text style={styles.dayCount}>{count}</Text> : null}
            </Pressable>
          );
        })}
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
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
              {overdue ? <Text style={styles.late}>Overdue / देर से</Text> : null}
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
  weekNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 8 },
  weekBtn: { padding: 8 },
  weekBtnTxt: { fontSize: 18, fontWeight: "800", color: COLORS.primary },
  weekLabel: { fontWeight: "700", color: COLORS.textSecondary },
  strip: { flexDirection: "row", paddingHorizontal: 8, paddingVertical: 8, gap: 4 },
  dayChip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  dayChipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  dayChipLate: { borderColor: COLORS.danger },
  dayTxt: { fontSize: 11, fontWeight: "700", color: COLORS.textPrimary },
  dayTxtOn: { color: "#fff" },
  dayCount: { fontSize: 10, fontWeight: "900", color: COLORS.accent, marginTop: 2 },
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
    gap: 6,
  },
  rowLate: { borderLeftColor: COLORS.danger },
  name: { fontWeight: "800", color: COLORS.textPrimary, fontSize: 15 },
  due: { fontWeight: "700", color: COLORS.textPrimary },
  type: { color: COLORS.textSecondary },
  late: { color: COLORS.danger, fontWeight: "700" },
});
