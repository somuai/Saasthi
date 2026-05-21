import { useEffect, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDatabase } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import { useDispatch } from "react-redux";
import { GovtHeader } from "../../components/GovtHeader";
import { ImmunizationRow } from "../../components/ImmunizationRow";
import { COLORS } from "../../constants/colors";
import { calculateVaccineDates, isoDate } from "../../utils/immunizationSchedule";
import { buildFicIncentiveIfEligible, ficProgress } from "../../utils/ficIncentive";
import { incrementPendingCount } from "../../features/sync/syncSlice";
import { todayYmd } from "../../utils/dateHelpers";

const VACCINE_LABELS = {
  BCG: { en: "BCG", hi: "बीसीजी" },
  HEPB: { en: "Hep-B", hi: "हेप-B" },
  OPV_0: { en: "OPV-0", hi: "ओपीवी-0" },
  OPV_1: { en: "OPV-1", hi: "ओपीवी-1" },
  PENTA_1: { en: "Penta-1", hi: "पेंटा-1" },
  MR_1: { en: "MR-1", hi: "एमआर-1" },
  VITA_1: { en: "Vitamin A-1", hi: "विटामिन A-1" },
};

export default function ImmunizationScreen() {
  const { patientId } = useLocalSearchParams();
  const database = useDatabase();
  const router = useRouter();
  const dispatch = useDispatch();
  const [patients, setPatients] = useState([]);
  const [patient, setPatient] = useState(null);
  const [records, setRecords] = useState([]);
  const [sheet, setSheet] = useState(null);
  const [ficToast, setFicToast] = useState(null);

  useEffect(() => {
    if (patientId) return undefined;
    const q = database.collections.get("patients").query(Q.where("is_deleted", false));
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
    const rq = database.collections
      .get("immunization_records")
      .query(Q.where("patient_id", patient.id), Q.where("is_deleted", false));
    const sub = rq.observe().subscribe(setRecords);
    return () => sub.unsubscribe();
  }, [database, patient]);

  const schedule = useMemo(() => {
    if (!patient?.dateOfBirth) return [];
    const dates = calculateVaccineDates(patient.dateOfBirth);
    return Object.entries(dates).map(([code, due]) => {
      const rec = records.find((r) => r.vaccineCode === code);
      const labels = VACCINE_LABELS[code] || { en: code, hi: code };
      return {
        code,
        vaccineCode: code,
        name: labels.en,
        nameHi: labels.hi,
        scheduledDate: isoDate(due),
        administeredDate: rec?.administeredDate,
        isAdministered: Boolean(rec?.isAdministered),
        isMissed: Boolean(rec?.isMissed),
        recordId: rec?.id,
      };
    });
  }, [patient, records]);

  async function markGiven(vaccine) {
    setSheet(vaccine);
  }

  async function confirmGive() {
    if (!sheet || !patient) return;
    const now = Date.now();
    const today = isoDate(new Date());
    let ficAwarded = false;
    await database.write(async () => {
      if (sheet.recordId) {
        const rec = await database.collections.get("immunization_records").find(sheet.recordId);
        await rec.update((r) => {
          r.isAdministered = true;
          r.administeredDate = today;
          r.isSynced = false;
          r.updatedAt = now;
        });
      } else {
        await database.collections.get("immunization_records").create((r) => {
          r.patientId = patient.id;
          r.vaccineCode = sheet.code;
          r.vaccineName = sheet.name;
          r.scheduledDate = sheet.scheduledDate;
          r.administeredDate = today;
          r.isAdministered = true;
          r.isMissed = false;
          r.isSynced = false;
          r.createdAt = now;
          r.updatedAt = now;
          r.isDeleted = false;
          r.isMock = false;
        });
      }

      const immRows = await database.collections
        .get("immunization_records")
        .query(Q.where("patient_id", patient.id), Q.where("is_deleted", false))
        .fetch();
      const administered = immRows.filter((r) => r.isAdministered).map((r) => r.vaccineCode);
      const priorIncentives = await database.collections
        .get("incentive_records")
        .query(Q.where("patient_id", patient.id), Q.where("is_deleted", false))
        .fetch();
      const existingTypes = priorIncentives.map((ir) => ir.actionType);
      const fic = buildFicIncentiveIfEligible({
        dateOfBirth: patient.dateOfBirth,
        administeredCodes: administered,
        existingActionTypes: existingTypes,
      });
      if (fic) {
        await database.collections.get("incentive_records").create((ir) => {
          ir.actionType = fic.actionType;
          ir.patientId = patient.id;
          ir.referenceId = patient.id;
          ir.points = fic.points;
          ir.amountInr = fic.amountInr;
          ir.periodDate = fic.periodDate;
          ir.isApproved = false;
          ir.isSynced = false;
          ir.isDeleted = false;
          ir.isMock = false;
          ir.createdAt = now;
          ir.updatedAt = now;
        });
        ficAwarded = true;
      }

      await database.collections.get("incentive_records").create((ir) => {
        ir.actionType = "IMMUNIZATION_GIVEN";
        ir.patientId = patient.id;
        ir.referenceId = sheet.code;
        ir.points = 5;
        ir.amountInr = 25;
        ir.periodDate = todayYmd();
        ir.isApproved = false;
        ir.isSynced = false;
        ir.isDeleted = false;
        ir.isMock = false;
        ir.createdAt = now;
        ir.updatedAt = now;
      });
    });
    dispatch(incrementPendingCount(ficAwarded ? 3 : 2));
    setSheet(null);
    if (ficAwarded) {
      setFicToast("FIC पूर्ण / Fully immunized — ₹50 incentive recorded");
      setTimeout(() => setFicToast(null), 4000);
    }
  }

  if (!patientId) {
    return (
      <View style={styles.page}>
        <GovtHeader titleHi="टीकाकरण" title="Immunization" showSync />
        <FlatList
          data={patients.filter((p) => p.dateOfBirth)}
          keyExtractor={(p) => p.id}
          style={styles.flatList}
          contentContainerStyle={styles.flatListContent}
          ListEmptyComponent={<Text style={styles.muted}>DOB वाले बच्चे चुनें / Select child with DOB</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.pick} onPress={() => router.setParams({ patientId: item.id })}>
              <Text style={styles.pickName}>{item.name}</Text>
              <Text style={styles.muted}>DOB {item.dateOfBirth}</Text>
            </Pressable>
          )}
        />
      </View>
    );
  }

  const fic = ficProgress(
    patient?.dateOfBirth,
    records.filter((r) => r.isAdministered).map((r) => r.vaccineCode)
  );

  return (
    <View style={styles.page}>
      <GovtHeader titleHi="टीकाकरण" title={patient?.name || "Immunization"} showBack showSync />
      <View style={styles.ficBar}>
        <Text style={styles.ficHi}>FIC प्रगति / FIC progress</Text>
        <Text style={styles.ficEn}>
          {fic.done}/{fic.total} core vaccines
        </Text>
      </View>
      {ficToast ? (
        <View style={styles.ficToast}>
          <Text style={styles.ficToastTxt}>{ficToast}</Text>
        </View>
      ) : null}
      <FlatList
        data={schedule}
        keyExtractor={(item) => item.code}
        style={styles.flatList}
        contentContainerStyle={styles.flatListContent2}
        ListEmptyComponent={<Text style={styles.muted}>DOB सेट करें / Set date of birth on patient</Text>}
        renderItem={({ item }) => <ImmunizationRow vaccine={item} onGive={markGiven} />}
      />
      <Modal visible={Boolean(sheet)} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Mark given / टीका दिया</Text>
            <Text style={styles.muted}>{sheet?.name}</Text>
            <Pressable style={styles.btn} onPress={confirmGive}>
              <Text style={styles.btnTxt}>Confirm / पुष्टि</Text>
            </Pressable>
            <Pressable onPress={() => setSheet(null)}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  flatList: { flex: 1 },
  flatListContent: { flexGrow: 1, padding: 16 },
  flatListContent2: { flexGrow: 1, padding: 16, paddingBottom: 40 },
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
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: COLORS.card, padding: 24, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  sheetTitle: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  btn: {
    marginTop: 20,
    minHeight: 52,
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  btnTxt: { color: "#fff", fontWeight: "800" },
  cancel: { textAlign: "center", marginTop: 16, color: COLORS.textSecondary },
  ficBar: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    backgroundColor: COLORS.navyLight,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  ficHi: { fontSize: 14, fontWeight: "800", color: COLORS.textPrimary },
  ficEn: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  ficToast: {
    marginHorizontal: 16,
    marginTop: 8,
    padding: 12,
    backgroundColor: COLORS.success,
    borderRadius: 8,
  },
  ficToastTxt: { color: "#fff", fontSize: 14, fontWeight: "700", textAlign: "center" },
});
