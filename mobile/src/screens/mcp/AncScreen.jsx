import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDatabase } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import { GovtHeader } from "../../components/GovtHeader";
import { GovtInput } from "../../components/GovtInput";
import { GovtButton } from "../../components/GovtButton";
import { ToggleRow } from "../../components/ToggleRow";
import { COLORS } from "../../constants/colors";
import { calculateEDD, calculatePOG, getANCDueDates, isoFromDate } from "../../utils/mcpHelpers";
import { incrementPendingCount } from "../../features/sync/syncSlice";
import { useDispatch } from "react-redux";

const VISITS = [1, 2, 3, 4, 5];

export default function AncScreen() {
  const { patientId } = useLocalSearchParams();
  const database = useDatabase();
  const router = useRouter();
  const dispatch = useDispatch();
  const [patients, setPatients] = useState([]);
  const [patient, setPatient] = useState(null);
  const [mother, setMother] = useState(null);
  const [visits, setVisits] = useState([]);
  const [activeVisit, setActiveVisit] = useState(1);
  const [form, setForm] = useState({
    weightKg: "",
    bpSystolic: "",
    bpDiastolic: "",
    hemoglobinGm: "",
    lmpDate: "",
    pulseRate: "",
    oedema: false,
    jaundice: false,
    fetalHeartRate: "",
    tt1Date: "",
    tt2Date: "",
    ifaTablets: "",
    isUnderPmsma: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (patientId) return undefined;
    const q = database.collections
      .get("patients")
      .query(Q.where("is_pregnant", true), Q.where("is_deleted", false));
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
    const mq = database.collections
      .get("mother_records")
      .query(Q.where("patient_id", patient.id), Q.where("is_deleted", false));
    const sub = mq.observe().subscribe((recs) => setMother(recs[0] || null));
    return () => sub.unsubscribe();
  }, [database, patient]);

  useEffect(() => {
    if (!mother?.id) {
      setVisits([]);
      return undefined;
    }
    const vq = database.collections
      .get("anc_visit_records")
      .query(Q.where("mother_record_id", mother.id), Q.where("is_deleted", false), Q.sortBy("visit_number", Q.asc));
    const sub = vq.observe().subscribe(setVisits);
    return () => sub.unsubscribe();
  }, [database, mother]);

  const lmp = form.lmpDate || mother?.lmpDate;
  const pog = lmp ? calculatePOG(lmp) : 0;
  const edd = lmp ? isoFromDate(calculateEDD(lmp)) : "—";
  const dueDates = lmp ? getANCDueDates(lmp) : {};

  const currentVisit = useMemo(
    () => visits.find((v) => v.visitNumber === activeVisit),
    [visits, activeVisit]
  );

  useEffect(() => {
    if (currentVisit) {
      setForm({
        weightKg: currentVisit.weightKg ? String(currentVisit.weightKg) : "",
        bpSystolic: currentVisit.bpSystolic ? String(currentVisit.bpSystolic) : "",
        bpDiastolic: currentVisit.bpDiastolic ? String(currentVisit.bpDiastolic) : "",
        hemoglobinGm: currentVisit.hemoglobinGm ? String(currentVisit.hemoglobinGm) : "",
        lmpDate: mother?.lmpDate || "",
        pulseRate: currentVisit.pulseRate ? String(currentVisit.pulseRate) : "",
        oedema: currentVisit.oedema === true,
        jaundice: currentVisit.jaundice === true,
        fetalHeartRate: currentVisit.fetalHeartRate ? String(currentVisit.fetalHeartRate) : "",
        tt1Date: mother?.ttInjection1Date || "",
        tt2Date: mother?.ttInjection2Date || "",
        ifaTablets: mother?.ifaTabletsIssued != null ? String(mother.ifaTabletsIssued) : "",
        isUnderPmsma: currentVisit.isUnderPmsma === true,
      });
    } else {
      setForm({
        weightKg: "",
        bpSystolic: "",
        bpDiastolic: "",
        hemoglobinGm: "",
        lmpDate: mother?.lmpDate || "",
        pulseRate: "",
        oedema: false,
        jaundice: false,
        fetalHeartRate: "",
        tt1Date: mother?.ttInjection1Date || "",
        tt2Date: mother?.ttInjection2Date || "",
        ifaTablets: mother?.ifaTabletsIssued != null ? String(mother.ifaTabletsIssued) : "",
        isUnderPmsma: false,
      });
    }
  }, [currentVisit, activeVisit, mother]);

  if (!patientId) {
    return (
      <View style={styles.page}>
        <GovtHeader titleHi="एएनसी" title="ANC Register" showSync />
        <FlatList
          data={patients}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={<Text style={styles.muted}>कोई गर्भवती मरीज नहीं / No pregnant patients</Text>}
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

  async function ensureMotherRecord() {
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

  async function saveVisit() {
    setSaving(true);
    try {
      const mr = await ensureMotherRecord();
      const now = Date.now();
      const today = isoFromDate(new Date());
      await database.write(async () => {
        const existing = visits.find((v) => v.visitNumber === activeVisit);
        if (existing) {
          await existing.update((rec) => {
            rec.visitDate = today;
            rec.pogWeeks = pog;
            rec.weightKg = form.weightKg ? Number(form.weightKg) : null;
            rec.bpSystolic = form.bpSystolic ? Number(form.bpSystolic) : null;
            rec.bpDiastolic = form.bpDiastolic ? Number(form.bpDiastolic) : null;
            rec.hemoglobinGm = form.hemoglobinGm ? Number(form.hemoglobinGm) : null;
            rec.pulseRate = form.pulseRate ? Number(form.pulseRate) : null;
            rec.oedema = form.oedema;
            rec.jaundice = form.jaundice;
            rec.fetalHeartRate = form.fetalHeartRate ? Number(form.fetalHeartRate) : null;
            rec.isUnderPmsma = form.isUnderPmsma;
            rec.isSynced = false;
            rec.updatedAt = now;
          });
        } else {
          await database.collections.get("anc_visit_records").create((rec) => {
            rec.motherRecordId = mr.id;
            rec.visitNumber = activeVisit;
            rec.visitDate = today;
            rec.pogWeeks = pog;
            rec.weightKg = form.weightKg ? Number(form.weightKg) : null;
            rec.bpSystolic = form.bpSystolic ? Number(form.bpSystolic) : null;
            rec.bpDiastolic = form.bpDiastolic ? Number(form.bpDiastolic) : null;
            rec.hemoglobinGm = form.hemoglobinGm ? Number(form.hemoglobinGm) : null;
            rec.pulseRate = form.pulseRate ? Number(form.pulseRate) : null;
            rec.oedema = form.oedema;
            rec.jaundice = form.jaundice;
            rec.fetalHeartRate = form.fetalHeartRate ? Number(form.fetalHeartRate) : null;
            rec.isUnderPmsma = form.isUnderPmsma;
            rec.isSynced = false;
            rec.createdAt = now;
            rec.updatedAt = now;
            rec.isDeleted = false;
            rec.isMock = false;
          });
        }
        if (lmp) {
          await mr.update((r) => {
            r.lmpDate = lmp;
            r.edd = edd;
            r.ttInjection1Date = form.tt1Date || r.ttInjection1Date;
            r.ttInjection2Date = form.tt2Date || r.ttInjection2Date;
            r.ifaTabletsIssued = form.ifaTablets ? Number(form.ifaTablets) : r.ifaTabletsIssued;
            r.isHighRisk =
              Number(form.bpSystolic) >= 140 ||
              Number(form.hemoglobinGm) < 11 ||
              form.oedema ||
              form.jaundice;
            r.isSynced = false;
            r.updatedAt = now;
          });
        }
      });
      dispatch(incrementPendingCount(1));
    } finally {
      setSaving(false);
    }
  }

  const alert =
    Number(form.bpSystolic) >= 140 || Number(form.hemoglobinGm) < 11
      ? "High risk — refer to ANM/PHC"
      : null;

  return (
    <View style={styles.page}>
      <GovtHeader titleHi="एएनसी" title={`ANC — ${patient.name}`} showBack showSync />
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scroll}>
        <Text style={styles.meta}>POG {pog}w · EDD {edd}</Text>
        <View style={styles.tabs}>
          {VISITS.map((n) => {
            const done = visits.some((v) => v.visitNumber === n && v.visitDate);
            const dueKey = `anc${n}`;
            return (
              <Pressable
                key={n}
                style={[styles.tab, activeVisit === n && styles.tabOn, done && styles.tabDone]}
                onPress={() => setActiveVisit(n)}
              >
                <Text style={styles.tabTxt}>ANC {n}</Text>
                <Text style={styles.tabSub}>{dueDates[dueKey] ? isoFromDate(dueDates[dueKey]) : ""}</Text>
              </Pressable>
            );
          })}
        </View>
        <GovtInput labelHi="LMP (YYYY-MM-DD)" label="LMP date" value={form.lmpDate} onChangeText={(t) => setForm({ ...form, lmpDate: t })} />
        <GovtInput labelHi="वजन (kg)" label="Weight" value={form.weightKg} onChangeText={(t) => setForm({ ...form, weightKg: t })} keyboardType="decimal-pad" />
        <GovtInput labelHi="BP systolic" label="BP systolic" value={form.bpSystolic} onChangeText={(t) => setForm({ ...form, bpSystolic: t })} keyboardType="number-pad" />
        <GovtInput labelHi="BP diastolic" label="BP diastolic" value={form.bpDiastolic} onChangeText={(t) => setForm({ ...form, bpDiastolic: t })} keyboardType="number-pad" />
        <GovtInput labelHi="Hb (g/dl)" label="Hemoglobin" value={form.hemoglobinGm} onChangeText={(t) => setForm({ ...form, hemoglobinGm: t })} keyboardType="decimal-pad" />
        <GovtInput labelHi="नाड़ी" label="Pulse rate" value={form.pulseRate} onChangeText={(t) => setForm({ ...form, pulseRate: t })} keyboardType="number-pad" />
        <GovtInput labelHi="भ्रूण HR" label="Fetal heart rate" value={form.fetalHeartRate} onChangeText={(t) => setForm({ ...form, fetalHeartRate: t })} keyboardType="number-pad" />
        <ToggleRow labelHi="सूजन (oedema)" labelEn="Oedema" value={form.oedema} onChange={(v) => setForm({ ...form, oedema: v })} />
        <ToggleRow labelHi="पीलिया" labelEn="Jaundice" value={form.jaundice} onChange={(v) => setForm({ ...form, jaundice: v })} />
        <ToggleRow labelHi="PMSMA के अंतर्गत" labelEn="Under PMSMA" value={form.isUnderPmsma} onChange={(v) => setForm({ ...form, isUnderPmsma: v })} />
        <GovtInput labelHi="TT-1 तिथि" label="TT dose 1 date" value={form.tt1Date} onChangeText={(t) => setForm({ ...form, tt1Date: t })} />
        <GovtInput labelHi="TT-2 तिथि" label="TT dose 2 date" value={form.tt2Date} onChangeText={(t) => setForm({ ...form, tt2Date: t })} />
        <GovtInput labelHi="IFA गोलियां" label="IFA tablets issued" value={form.ifaTablets} onChangeText={(t) => setForm({ ...form, ifaTablets: t })} keyboardType="number-pad" />
        {alert ? <Text style={styles.alert}>{alert}</Text> : null}
        <GovtButton titleHi="सहेजें" titleEn="Save visit" onPress={saveVisit} loading={saving} />
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
  meta: { color: COLORS.textSecondary, marginBottom: 12 },
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
});
