import { useEffect, useMemo, useState } from "react";
import { Dimensions, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline } from "react-native-svg";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDatabase } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import { useDispatch } from "react-redux";
import { ErrorState } from "../../components/ErrorState";
import { GovtHeader } from "../../components/GovtHeader";
import { GovtInput } from "../../components/GovtInput";
import { GovtButton } from "../../components/GovtButton";
import { COLORS } from "../../constants/colors";
import { classifyNutrition, nutritionLabel, weightForAgeZ, whoChartBandLines } from "../../constants/whoGrowth";
import { isoFromDate } from "../../utils/mcpHelpers";
import { incrementPendingCount } from "../../features/sync/syncSlice";

const W = Dimensions.get("window").width - 32;

export default function GrowthScreen() {
  const { patientId } = useLocalSearchParams();
  const database = useDatabase();
  const router = useRouter();
  const dispatch = useDispatch();
  const [patients, setPatients] = useState([]);
  const [patient, setPatient] = useState(null);
  const [records, setRecords] = useState([]);
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [ageMonths, setAgeMonths] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    try {
      if (patientId) return undefined;
      const q = database.collections.get("patients").query(Q.where("is_deleted", false));
      const sub = q.observe().subscribe(setPatients);
      return () => sub.unsubscribe();
    } catch (e) {
      setLoadError(e?.message || "Failed to load patients");
      return undefined;
    }
  }, [database, patientId]);

  useEffect(() => {
    try {
      if (!patientId) return undefined;
      const pq = database.collections.get("patients").query(Q.where("id", patientId));
      const sub = pq.observe().subscribe((recs) => setPatient(recs[0] || null));
      return () => sub.unsubscribe();
    } catch (e) {
      setLoadError(e?.message || "Failed to load patient");
      return undefined;
    }
  }, [database, patientId]);

  useEffect(() => {
    try {
      if (!patient?.id) return undefined;
      const gq = database.collections
        .get("growth_records")
        .query(Q.where("patient_id", patient.id), Q.where("is_deleted", false), Q.sortBy("recorded_date", Q.asc));
      const sub = gq.observe().subscribe(setRecords);
      return () => sub.unsubscribe();
    } catch (e) {
      setLoadError(e?.message || "Failed to load growth records");
      return undefined;
    }
  }, [database, patient]);

  const bands = useMemo(() => whoChartBandLines(W, 120), []);

  const chartPoints = useMemo(() => {
    if (!records.length) return "";
    const maxW = Math.max(...records.map((r) => r.weightKg || 0), bands.chartHeight / 2, 1);
    return records
      .map((r, i) => {
        const x = (i / Math.max(records.length - 1, 1)) * (W - 40) + 20;
        const y = 120 - ((r.weightKg || 0) / maxW) * 100;
        return `${x},${y}`;
      })
      .join(" ");
  }, [records, bands.chartHeight]);

  const previewZ = weight && ageMonths ? weightForAgeZ(weight, ageMonths) : null;
  const previewStatus = classifyNutrition(previewZ);

  async function saveRecord() {
    if (!patient || !weight) return;
    setSaving(true);
    const now = Date.now();
    const today = isoFromDate(new Date());
    const z = weightForAgeZ(weight, ageMonths || 0);
    const status = classifyNutrition(z);
    try {
      await database.write(async () => {
        await database.collections.get("growth_records").create((rec) => {
          rec.patientId = patient.id;
          rec.recordedDate = today;
          rec.ageMonths = ageMonths ? Number(ageMonths) : null;
          rec.weightKg = Number(weight);
          rec.heightCm = height ? Number(height) : null;
          rec.weightForAgeZ = z;
          rec.nutritionStatus = status;
          rec.isSynced = false;
          rec.createdAt = now;
          rec.updatedAt = now;
          rec.isDeleted = false;
          rec.isMock = false;
        });
        await patient.update((p) => {
          p.latestWeightForAgeZ = z;
          p.isSynced = false;
          p.updatedAt = now;
        });
      });
      dispatch(incrementPendingCount(2));
      setWeight("");
      setHeight("");
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <View style={styles.page}>
        <ErrorState message={loadError} onRetry={() => setLoadError(null)} />
      </View>
    );
  }

  if (!patientId) {
    return (
      <View style={styles.page}>
        <GovtHeader titleHi="वृद्धि" title="Growth monitoring" showSync />
        <FlatList
          data={patients}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <Pressable style={styles.pick} onPress={() => router.setParams({ patientId: item.id })}>
              <Text style={styles.pickName}>{item.name}</Text>
            </Pressable>
          )}
        />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <GovtHeader titleHi="वृद्धि" title={patient?.name || "Growth"} showBack showSync />
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scroll}>
        <Text style={styles.h}>Weight trend / वजन प्रवृत्ति</Text>
        <Svg width={W} height={140} style={styles.chart}>
          <Line x1={20} y1={120} x2={W - 20} y2={120} stroke={COLORS.border} strokeWidth={1} />
          <Polyline points={bands.minus2} fill="none" stroke={COLORS.warning} strokeWidth={1} strokeDasharray="4 3" />
          <Polyline points={bands.median} fill="none" stroke={COLORS.textHint} strokeWidth={1} />
          <Polyline points={bands.plus2} fill="none" stroke={COLORS.warning} strokeWidth={1} strokeDasharray="4 3" />
          {chartPoints ? <Polyline points={chartPoints} fill="none" stroke={COLORS.primary} strokeWidth={2} /> : null}
          {records.map((r, i) => {
            const maxW = Math.max(...records.map((x) => x.weightKg || 0), 1);
            const x = (i / Math.max(records.length - 1, 1)) * (W - 40) + 20;
            const y = 120 - ((r.weightKg || 0) / maxW) * 100;
            return <Circle key={r.id} cx={x} cy={y} r={4} fill={COLORS.accent} />;
          })}
        </Svg>
        {records.slice(-3).map((r) => (
          <View key={r.id} style={styles.row}>
            <Text>
              {r.recordedDate?.slice(0, 10)} — {r.weightKg} kg
            </Text>
            <Text style={styles.statusTag}>{nutritionLabel(r.nutritionStatus)}</Text>
          </View>
        ))}
        <Text style={styles.h}>New measurement / नया माप</Text>
        <GovtInput labelHi="आयु (माह)" label="Age months" value={ageMonths} onChangeText={setAgeMonths} keyboardType="number-pad" />
        <GovtInput labelHi="वजन (kg)" label="Weight kg" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" />
        <GovtInput labelHi="ऊंचाई (cm)" label="Height cm" value={height} onChangeText={setHeight} keyboardType="decimal-pad" />
        {previewZ != null ? (
          <Text style={styles.z}>
            WFA z-score: {previewZ} — {nutritionLabel(previewStatus)}
          </Text>
        ) : null}
        {(previewStatus === "sam" || previewStatus === "mam") && <Text style={styles.alert}>SAM/MAM flag — refer to AWC/PHC</Text>}
        <GovtButton titleHi="सहेजें" titleEn="Save" onPress={saveRecord} loading={saving} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  scrollContainer: { flex: 1 },
  scroll: { flexGrow: 1, padding: 16, paddingBottom: 40 },
  pick: {
    padding: 14,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  pickName: { fontWeight: "800", color: COLORS.textPrimary },
  h: { fontWeight: "800", color: COLORS.textPrimary, marginBottom: 8, marginTop: 8 },
  chart: { backgroundColor: COLORS.card, borderRadius: 8, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8 },
  statusTag: { fontSize: 11, fontWeight: "700", color: COLORS.danger },
  z: { color: COLORS.textSecondary, marginVertical: 8 },
  alert: { color: COLORS.danger, fontWeight: "800", marginBottom: 12 },
});
