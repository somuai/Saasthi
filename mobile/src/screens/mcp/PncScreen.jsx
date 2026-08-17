import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDatabase } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import { useDispatch } from "react-redux";
import { GovtHeader } from "../../components/GovtHeader";
import { GovtInput } from "../../components/GovtInput";
import { GovtButton } from "../../components/GovtButton";
import { ToggleRow } from "../../components/ToggleRow";
import { COLORS } from "../../constants/colors";
import { isoFromDate, todayYmd } from "../../utils/dateHelpers";
import { incrementPendingCount } from "../../features/sync/syncSlice";
import { translateHindiText, useLocale } from "../../utils/localization";

const PNC_DAYS = [
  { key: "day1", field: "pncDay1Json", labelHi: "दिन 1", labelEn: "Day 1" },
  { key: "day3", field: "pncDay3Json", labelHi: "दिन 3", labelEn: "Day 3" },
  { key: "day7", field: "pncDay7Json", labelHi: "दिन 7", labelEn: "Day 7" },
  { key: "day14", field: "pncDay14Json", labelHi: "दिन 14", labelEn: "Day 14" },
  { key: "day21", field: "pncDay21Json", labelHi: "दिन 21", labelEn: "Day 21" },
  { key: "day28", field: "pncDay28Json", labelHi: "दिन 28", labelEn: "Day 28" },
  { key: "day42", field: "pncDay42Json", labelHi: "दिन 42", labelEn: "Day 42" },
];

function parsePnc(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default function PncScreen() {
  const { patientId } = useLocalSearchParams();
  const database = useDatabase();
  const router = useRouter();
  const dispatch = useDispatch();
  const locale = useLocale();
  const hiText = (hi) => (locale === "en" ? hi : translateHindiText(hi, locale));
  const [patients, setPatients] = useState([]);
  const [patient, setPatient] = useState(null);
  const [mother, setMother] = useState(null);
  const [activeDay, setActiveDay] = useState("day1");
  const [form, setForm] = useState({
    visitDate: todayYmd(),
    motherTemp: "",
    excessiveBleeding: false,
    breastfeeding: true,
    babyWeightKg: "",
    babyTemp: "",
    fever: false,
    notes: "",
    sepsisLethargy: false,
    sepsisConvulsions: false,
    sepsisChestIndrawing: false,
    sepsisTempInstability: false,
    sepsisUmbilicalPus: false,
    sepsisPoorFeeding: false,
    sepsisFastBreathing: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (patientId) return undefined;
    const q = database.collections.get("patients").query(Q.where("is_pregnant", true), Q.where("is_deleted", false));
    const sub = q.observe().subscribe(setPatients);
    return () => sub.unsubscribe();
  }, [database, patientId]);

  useEffect(() => {
    if (!patientId) return undefined;
    const pq = database.collections.get("patients").query(Q.where("id", patientId));
    const sub = pq.observe().subscribe((recs) => setPatient(recs[0] || null));
    return () => sub.unsubscribe();
  }, [database, patientId]);

  useEffect(() => {
    if (!patient?.id) return undefined;
    const mq = database.collections.get("mother_records").query(Q.where("patient_id", patient.id), Q.where("is_deleted", false));
    const sub = mq.observe().subscribe((recs) => setMother(recs[0] || null));
    return () => sub.unsubscribe();
  }, [database, patient]);

  const dayMeta = PNC_DAYS.find((d) => d.key === activeDay);
  const saved = useMemo(() => parsePnc(mother?.[dayMeta?.field]), [mother, dayMeta]);

  useEffect(() => {
    setForm({
      visitDate: saved.visitDate || todayYmd(),
      motherTemp: saved.motherTemp != null ? String(saved.motherTemp) : "",
      excessiveBleeding: saved.excessiveBleeding === true,
      breastfeeding: saved.breastfeeding !== false,
      babyWeightKg: saved.babyWeightKg != null ? String(saved.babyWeightKg) : "",
      babyTemp: saved.babyTemp != null ? String(saved.babyTemp) : "",
      fever: saved.fever === true,
      notes: saved.notes || "",
      sepsisLethargy: saved.sepsisLethargy === true,
      sepsisConvulsions: saved.sepsisConvulsions === true,
      sepsisChestIndrawing: saved.sepsisChestIndrawing === true,
      sepsisTempInstability: saved.sepsisTempInstability === true,
      sepsisUmbilicalPus: saved.sepsisUmbilicalPus === true,
      sepsisPoorFeeding: saved.sepsisPoorFeeding === true,
      sepsisFastBreathing: saved.sepsisFastBreathing === true,
    });
  }, [activeDay, mother, saved.visitDate]);

  if (!patientId) {
    return (
      <View style={styles.page}>
        <GovtHeader titleHi="PNC" title="Postnatal care" showSync />
        <FlatList
          data={patients}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={styles.muted}>{hiText("कोई गर्भवती मरीज नहीं")}</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.pick} onPress={() => router.setParams({ patientId: item.id })}>
              <Text style={styles.pickName}>{item.name}</Text>
              <Text style={styles.muted}>{item.patientCode}</Text>
            </Pressable>
          )}
        />
      </View>
    );
  }

  if (!patient) {
    return (
      <View style={styles.page}>
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  async function ensureMother() {
    if (mother) return mother;
    let created;
    const now = Date.now();
    await database.write(async () => {
      created = await database.collections.get("mother_records").create((rec) => {
        rec.patientId = patient.id;
        rec.isSynced = false;
        rec.createdAt = now;
        rec.updatedAt = now;
        rec.isDeleted = false;
        rec.isMock = false;
      });
    });
    dispatch(incrementPendingCount(1));
    return created;
  }

  const hasSepsisDangerSign =
    form.sepsisLethargy ||
    form.sepsisConvulsions ||
    form.sepsisChestIndrawing ||
    form.sepsisTempInstability ||
    form.sepsisUmbilicalPus ||
    form.sepsisPoorFeeding ||
    form.sepsisFastBreathing;

  async function savePnc() {
    setSaving(true);
    try {
      const mr = await ensureMother();
      const payload = {
        visitDay: activeDay,
        visitDate: form.visitDate || isoFromDate(new Date()),
        motherTemp: form.motherTemp ? Number(form.motherTemp) : null,
        excessiveBleeding: form.excessiveBleeding,
        breastfeeding: form.breastfeeding,
        babyWeightKg: form.babyWeightKg ? Number(form.babyWeightKg) : null,
        babyTemp: form.babyTemp ? Number(form.babyTemp) : null,
        fever: form.fever,
        notes: form.notes,
        sepsisLethargy: form.sepsisLethargy,
        sepsisConvulsions: form.sepsisConvulsions,
        sepsisChestIndrawing: form.sepsisChestIndrawing,
        sepsisTempInstability: form.sepsisTempInstability,
        sepsisUmbilicalPus: form.sepsisUmbilicalPus,
        sepsisPoorFeeding: form.sepsisPoorFeeding,
        sepsisFastBreathing: form.sepsisFastBreathing,
      };
      const now = Date.now();
      await database.write(async () => {
        await mr.update((r) => {
          r[dayMeta.field] = JSON.stringify(payload);
          r.isSynced = false;
          r.updatedAt = now;
        });
        if (hasSepsisDangerSign) {
          await database.collections.get("referrals").create((ref) => {
            ref.patientId = patient.id;
            ref.providerName = "Clinician Network (Bypass)";
            ref.providerType = "clinician";
            ref.diseaseCategory = "neonatal_sepsis";
            ref.referralDate = form.visitDate || todayYmd();
            ref.status = "sent";
            ref.isSynced = false;
            ref.isDeleted = false;
            ref.isMock = false;
            ref.createdAt = now;
            ref.updatedAt = now;
          });
        }
      });
      dispatch(incrementPendingCount(hasSepsisDangerSign ? 2 : 1));
    } finally {
      setSaving(false);
    }
  }

  const isHighRisk = patient?.riskLevel === "high" || patient?.riskLevel === "critical";
  const headerBgColor = isHighRisk ? "#D32F2F" : COLORS.matriMaAccent;
  const pageBg = isHighRisk ? COLORS.background : COLORS.matriMaBg;

  return (
    <View style={[{ flex: 1, backgroundColor: pageBg }, isHighRisk && { borderWidth: 3, borderColor: "#D32F2F" }]}>
      <GovtHeader titleHi="PNC" title={`PNC — ${patient.name}`} showBack showSync backgroundColor={headerBgColor} />
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scroll}>
        <View style={styles.tabs}>
          {PNC_DAYS.map((d) => {
            const done = mother?.[d.field] && String(mother[d.field]).length > 2;
            return (
              <Pressable
                key={d.key}
                style={[styles.tab, activeDay === d.key && styles.tabOn, done && styles.tabDone]}
                onPress={() => setActiveDay(d.key)}
              >
                <Text style={styles.tabTxt}>{hiText(d.labelHi)}</Text>
                <Text style={styles.tabSub}>{d.labelEn}</Text>
              </Pressable>
            );
          })}
        </View>
        <GovtInput
          labelHi="भेंट तिथि"
          label="Visit date (YYYY-MM-DD)"
          value={form.visitDate}
          onChangeText={(t) => setForm({ ...form, visitDate: t })}
        />
        <GovtInput
          labelHi="मां का तापमान"
          label="Mother temp °C"
          value={form.motherTemp}
          onChangeText={(t) => setForm({ ...form, motherTemp: t })}
          keyboardType="decimal-pad"
        />
        <ToggleRow
          labelHi="अत्यधिक रक्तस्राव"
          labelEn="Excessive bleeding"
          value={form.excessiveBleeding}
          onChange={(v) => setForm({ ...form, excessiveBleeding: v })}
        />
        <ToggleRow
          labelHi="स्तनपान"
          labelEn="Breastfeeding"
          value={form.breastfeeding}
          onChange={(v) => setForm({ ...form, breastfeeding: v })}
        />
        <GovtInput
          labelHi="शिशु वजन (kg)"
          label="Baby weight kg"
          value={form.babyWeightKg}
          onChangeText={(t) => setForm({ ...form, babyWeightKg: t })}
          keyboardType="decimal-pad"
        />
        <GovtInput
          labelHi="शिशु तापमान (°C)"
          label="Baby temperature (°C)"
          value={form.babyTemp}
          onChangeText={(t) => setForm({ ...form, babyTemp: t })}
          keyboardType="decimal-pad"
        />
        <ToggleRow labelHi="बुखार" labelEn="Fever" value={form.fever} onChange={(v) => setForm({ ...form, fever: v })} />
        <GovtInput labelHi="नोट्स" label="Notes" value={form.notes} onChangeText={(t) => setForm({ ...form, notes: t })} multiline />

        <Text style={styles.sectionHeader}>Sepsis Danger Signs (HBNC Digital Grid)</Text>
        <ToggleRow
          labelHi="सुस्ती (Lethargy)"
          labelEn="Lethargy"
          value={form.sepsisLethargy}
          onChange={(v) => setForm({ ...form, sepsisLethargy: v })}
        />
        <ToggleRow
          labelHi="ऐंठन (Convulsions)"
          labelEn="Convulsions"
          value={form.sepsisConvulsions}
          onChange={(v) => setForm({ ...form, sepsisConvulsions: v })}
        />
        <ToggleRow
          labelHi="पसली चलना (Chest Indrawing)"
          labelEn="Chest Indrawing"
          value={form.sepsisChestIndrawing}
          onChange={(v) => setForm({ ...form, sepsisChestIndrawing: v })}
        />
        <ToggleRow
          labelHi="तापमान अस्थिरता (Temp Instability)"
          labelEn="Temp Instability"
          value={form.sepsisTempInstability}
          onChange={(v) => setForm({ ...form, sepsisTempInstability: v })}
        />
        <ToggleRow
          labelHi="नाभि में मवाद (Umbilical Pus)"
          labelEn="Umbilical Pus"
          value={form.sepsisUmbilicalPus}
          onChange={(v) => setForm({ ...form, sepsisUmbilicalPus: v })}
        />
        <ToggleRow
          labelHi="कमजोर दूध पीना (Poor Feeding)"
          labelEn="Poor Feeding"
          value={form.sepsisPoorFeeding}
          onChange={(v) => setForm({ ...form, sepsisPoorFeeding: v })}
        />
        <ToggleRow
          labelHi="तेज सांस लेना (Fast Breathing)"
          labelEn="Fast Breathing"
          value={form.sepsisFastBreathing}
          onChange={(v) => setForm({ ...form, sepsisFastBreathing: v })}
        />

        {hasSepsisDangerSign && (
          <Text style={[styles.alert, { color: COLORS.danger }]}>
            🚨 URGENT: Sepsis danger sign detected! Saving will automatically create an immediate urgent clinician referral bypass.
          </Text>
        )}
        {(form.excessiveBleeding || form.fever) && <Text style={styles.alert}>Refer to ANM/PHC — maternal danger signs reported</Text>}
        <GovtButton titleHi="सहेजें" titleEn="Save PNC visit" onPress={savePnc} loading={saving} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  scrollContainer: { flex: 1 },
  scroll: { flexGrow: 1, padding: 16, paddingBottom: 40 },
  muted: { color: COLORS.textSecondary, padding: 16 },
  pick: {
    padding: 14,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  pickName: { fontWeight: "800", color: COLORS.textPrimary },
  tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  tab: {
    minWidth: 72,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  tabOn: { borderColor: COLORS.primary, backgroundColor: COLORS.navyLight },
  tabDone: { borderLeftWidth: 4, borderLeftColor: COLORS.success },
  tabTxt: { fontWeight: "800", fontSize: 13 },
  tabSub: { fontSize: 10, color: COLORS.textHint, marginTop: 2 },
  alert: { color: COLORS.danger, fontWeight: "800", marginBottom: 12 },
  sectionHeader: { fontSize: 15, fontWeight: "800", color: COLORS.textPrimary, marginTop: 16, marginBottom: 8 },
});
