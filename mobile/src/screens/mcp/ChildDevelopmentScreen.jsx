import { useEffect, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDatabase } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import { useDispatch } from "react-redux";
import { ErrorState } from "../../components/ErrorState";
import { GovtHeader } from "../../components/GovtHeader";
import { GovtButton } from "../../components/GovtButton";
import { GovtInput } from "../../components/GovtInput";
import { ToggleRow } from "../../components/ToggleRow";
import { COLORS } from "../../constants/colors";
import { isoFromDate } from "../../utils/mcpHelpers";
import { incrementPendingCount } from "../../features/sync/syncSlice";
import { useLocale, translateHindiText } from "../../utils/localization";

const DEFAULT_MILESTONES = [
  { key: "social_smile", hi: "सामाजिक मुस्कान", en: "Social smile", months: 2 },
  { key: "head_control", hi: "सिर नियंत्रण", en: "Head control", months: 4 },
  { key: "sits", hi: "बैठना", en: "Sits without support", months: 6 },
  { key: "stands", hi: "खड़ा होना", en: "Stands with support", months: 9 },
  { key: "walks", hi: "चलना", en: "Walks", months: 12 },
];

export default function ChildDevelopmentScreen() {
  const { patientId } = useLocalSearchParams();
  const database = useDatabase();
  const router = useRouter();
  const dispatch = useDispatch();
  const [patients, setPatients] = useState([]);
  const [patient, setPatient] = useState(null);
  const [records, setRecords] = useState([]);
  const [ageMonths, setAgeMonths] = useState("12");
  const [referralNeeded, setReferralNeeded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const locale = useLocale();
  const hiText = (hi) => (locale === "en" ? hi : translateHindiText(hi, locale));

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
      const cq = database.collections
        .get("child_development")
        .query(Q.where("patient_id", patient.id), Q.where("is_deleted", false), Q.sortBy("assessment_date", Q.desc));
      const sub = cq.observe().subscribe(setRecords);
      return () => sub.unsubscribe();
    } catch (e) {
      setLoadError(e?.message || "Failed to load child development records");
      return undefined;
    }
  }, [database, patient]);

  async function saveAssessment() {
    if (!patient) return;
    setSaving(true);
    const now = Date.now();
    const today = isoFromDate(new Date());
    const milestones = DEFAULT_MILESTONES.filter((m) => Number(ageMonths) >= m.months);
    try {
      await database.write(async () => {
        await database.collections.get("child_development").create((rec) => {
          rec.patientId = patient.id;
          rec.assessmentDate = today;
          rec.ageMonths = Number(ageMonths) || null;
          rec.milestonesJson = JSON.stringify(milestones);
          rec.warningSignsJson = JSON.stringify(referralNeeded ? ["delayed_milestones"] : []);
          rec.assessedBy = "asha";
          rec.referralNeeded = referralNeeded;
          rec.isSynced = false;
          rec.createdAt = now;
          rec.updatedAt = now;
          rec.isDeleted = false;
          rec.isMock = false;
        });
      });
      dispatch(incrementPendingCount(1));
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
        <GovtHeader titleHi="बाल विकास" title="Child development" showSync />
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
      <GovtHeader titleHi="बाल विकास" title={patient?.name || "Child dev."} showBack showSync />
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scroll}>
        <Text style={styles.h}>{hiText("मील के पत्थर / Milestones (WHO-IYCF aligned)")}</Text>
        {DEFAULT_MILESTONES.map((m) => (
          <Text key={m.key} style={styles.milestone}>
            {hiText(m.hi)} / {m.en} — {m.months}m
          </Text>
        ))}
        <GovtInput labelHi="आयु (माह)" label="Age months" value={ageMonths} onChangeText={setAgeMonths} keyboardType="number-pad" />
        <ToggleRow labelHi="रेफरल आवश्यक" labelEn="Referral needed" value={referralNeeded} onChange={setReferralNeeded} />
        <GovtButton titleHi="मूल्यांकन सहेजें" titleEn="Save assessment" onPress={saveAssessment} loading={saving} />
        <Text style={[styles.h, { marginTop: 16 }]}>{hiText("इतिहास / History")}</Text>
        {records.map((r) => (
          <View key={r.id} style={styles.row}>
            <Text style={styles.pickName}>{r.assessmentDate}</Text>
            <Text style={styles.muted}>
              {r.ageMonths} months · referral: {r.referralNeeded ? "yes" : "no"}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  scrollContainer: { flex: 1 },
  scroll: { flexGrow: 1, padding: 16, paddingBottom: 40 },
  h: { fontWeight: "800", color: COLORS.textPrimary, marginBottom: 8 },
  milestone: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 },
  pick: {
    padding: 14,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 10,
  },
  pickName: { fontWeight: "800", color: COLORS.textPrimary },
  muted: { fontSize: 12, color: COLORS.textSecondary },
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
});
