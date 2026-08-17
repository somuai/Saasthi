import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDatabase } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import { COLORS } from "../../constants/colors";
import { spacing, radii } from "../../constants/design";
import { GovtHeader } from "../../components/GovtHeader";
import { GovtButton } from "../../components/GovtButton";
import { ListRow } from "../../components/ListRow";
import { calculateEDD, calculatePOG, getANCDueDates, calculateANCStatus, isoFromDate } from "../../utils/mcpHelpers";
import { todayYmd, formatIndianDate } from "../../utils/dateHelpers";
import { useLocale, translateHindiText } from "../../utils/localization";

function StatCard({ labelHi, labelEn, value, color }) {
  const locale = useLocale();
  const hiText = (hi) => (locale === "en" ? hi : translateHindiText(hi, locale));
  return (
    <View style={[statStyles.card, color ? { borderLeftColor: color } : null]}>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.hi}>{hiText(labelHi)}</Text>
      <Text style={statStyles.en}>{labelEn}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    padding: spacing.md,
    alignItems: "center",
    minWidth: 100,
  },
  value: { fontSize: 28, fontWeight: "800", color: COLORS.textPrimary },
  hi: { fontSize: 11, color: COLORS.textPrimary, marginTop: 2 },
  en: { fontSize: 10, color: COLORS.textSecondary },
});

function StatusBadge({ label, color }) {
  const locale = useLocale();
  const hiText = (hi) => (locale === "en" ? hi : translateHindiText(hi, locale));
  return (
    <View style={[badgeStyles.badge, { backgroundColor: color + "20", borderColor: color }]}>
      <Text style={[badgeStyles.text, { color }]}>{hiText(label)}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  text: { fontSize: 11, fontWeight: "700" },
});

function ProgressBar({ current, total, label }) {
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${Math.min((current / total) * 100, 100)}%` }]} />
      </View>
      <Text style={styles.progressLabel}>{label}</Text>
    </View>
  );
}

export default function PregnancyDashboardScreen() {
  const { patientId } = useLocalSearchParams();
  const database = useDatabase();
  const router = useRouter();
  const [patients, setPatients] = useState([]);
  const [patient, setPatient] = useState(null);
  const [mother, setMother] = useState(null);
  const [visits, setVisits] = useState([]);
  const [flags, setFlags] = useState([]);
  const [immunizations, setImmunizations] = useState([]);

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

  useEffect(() => {
    if (!patient?.id) {
      setFlags([]);
      return undefined;
    }
    const fq = database.collections
      .get("flags")
      .query(Q.where("patient_id", patient.id), Q.where("is_resolved", false), Q.where("is_deleted", false));
    const sub = fq.observe().subscribe(setFlags);
    return () => sub.unsubscribe();
  }, [database, patient]);

  useEffect(() => {
    if (!patient?.id) {
      setImmunizations([]);
      return undefined;
    }
    const iq = database.collections.get("immunization_records").query(Q.where("patient_id", patient.id), Q.where("is_deleted", false));
    const sub = iq.observe().subscribe(setImmunizations);
    return () => sub.unsubscribe();
  }, [database, patient]);

  const locale = useLocale();
  const hiText = (hi) => (locale === "en" ? hi : translateHindiText(hi, locale));

  const lmp = mother?.lmpDate || patient?.lmpDate;
  const pog = lmp ? calculatePOG(lmp) : 0;
  const edd = lmp ? isoFromDate(calculateEDD(lmp)) : "—";
  const ancStatus = useMemo(() => calculateANCStatus(visits), [visits]);
  const dueDates = lmp ? getANCDueDates(lmp) : {};
  const isDelivered = mother?.deliveryDate ? true : false;

  if (!patientId) {
    return (
      <View style={styles.page}>
        <GovtHeader titleHi="गर्भावस्था डैशबोर्ड" title="Pregnancy Dashboard" showSync />
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
        <GovtHeader titleHi="डैशबोर्ड" title="Dashboard" />
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  const riskColor = mother?.isHighRisk ? COLORS.danger : COLORS.success;
  const riskLabel = mother?.isHighRisk ? "High Risk / उच्च जोखिम" : "Low Risk / सामान्य";

  return (
    <View style={styles.page}>
      <GovtHeader
        titleHi="गर्भावस्था डैशबोर्ड"
        title={patient.name}
        showBack
        showSync
        rightComponent={<StatusBadge label={riskLabel} color={riskColor} />}
      />
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scroll}>
        <Text style={styles.patientName}>{patient.name}</Text>
        <Text style={styles.muted}>
          {patient.patientCode} · {patient.age || "?"} yrs
        </Text>

        <View style={styles.statsRow}>
          <StatCard labelHi="POG" labelEn="Weeks" value={`${pog}w`} color={COLORS.primary} />
          <StatCard labelHi="EDD" labelEn="Due date" value={edd ? formatIndianDate(edd) : "—"} color={COLORS.accent} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{hiText("ANC Visits / एएनसी भेंट")}</Text>
          <ProgressBar current={ancStatus.completed} total={ancStatus.target} label={`${ancStatus.completed}/${ancStatus.target}`} />
          {!isDelivered && (
            <View style={styles.visitTabs}>
              {[1, 2, 3, 4].map((n) => {
                const done = visits.some((v) => v.visitNumber === n && v.visitDate);
                const dueKey = `anc${n}`;
                return (
                  <Pressable
                    key={n}
                    style={[styles.visitTab, done && styles.visitDone]}
                    onPress={() => router.push({ pathname: "/(tabs)/mcp/anc", params: { patientId } })}
                  >
                    <Text style={[styles.visitNum, done && styles.visitNumDone]}>{n}</Text>
                    <Text style={styles.visitDue}>{dueDates[dueKey] ? formatIndianDate(isoFromDate(dueDates[dueKey])) : ""}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{hiText("TT Injections / टीटी इंजेक्शन")}</Text>
          <Text style={styles.meta}>
            TT1: {mother?.ttInjection1Date ? formatIndianDate(mother.ttInjection1Date) : hiText("Pending / बाकी")}
          </Text>
          <Text style={styles.meta}>
            TT2: {mother?.ttInjection2Date ? formatIndianDate(mother.ttInjection2Date) : hiText("Pending / बाकी")}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{hiText("IFA / आयरन फोलिक एसिड")}</Text>
          <Text style={styles.meta}>Issued: {mother?.ifaTabletsIssued != null ? `${mother.ifaTabletsIssued} tablets` : "0 tablets"}</Text>
        </View>

        {mother?.jsyRegistered && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{hiText("JSY / जननी सुरक्षा योजना")}</Text>
            <Text style={styles.meta}>Registered: Yes</Text>
          </View>
        )}

        {flags.length > 0 && (
          <View style={[styles.card, { borderLeftColor: COLORS.danger, borderLeftWidth: 4 }]}>
            <Text style={[styles.cardTitle, { color: COLORS.danger }]}>
              {hiText("Open Flags / खुले फ़्लैग")} ({flags.length})
            </Text>
            {flags.slice(0, 3).map((f) => (
              <Text key={f.id} style={styles.flagItem}>
                • {f.flagType}: {f.description || f.severity}
              </Text>
            ))}
          </View>
        )}

        {!isDelivered && (
          <GovtButton
            titleHi="डिलीवरी दर्ज करें"
            titleEn="Record delivery"
            variant="secondary"
            onPress={() => router.push({ pathname: "/(tabs)/mcp/pnc", params: { patientId } })}
          />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  scrollContainer: { flex: 1 },
  scroll: { flexGrow: 1, padding: 16, paddingBottom: 40, gap: spacing.md },
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
  patientName: { fontSize: 20, fontWeight: "800", color: COLORS.textPrimary },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginVertical: spacing.sm },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
    marginBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 4,
  },
  meta: { fontSize: 13, color: COLORS.textSecondary, padding: 0 },
  progressWrap: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  progressBg: { flex: 1, height: 8, backgroundColor: COLORS.border, borderRadius: 4 },
  progressFill: { height: 8, backgroundColor: COLORS.success, borderRadius: 4 },
  progressLabel: { fontSize: 12, fontWeight: "700", color: COLORS.textSecondary },
  visitTabs: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs },
  visitTab: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: "center",
  },
  visitDone: { borderLeftWidth: 3, borderLeftColor: COLORS.success },
  visitNum: { fontSize: 16, fontWeight: "800", color: COLORS.textPrimary },
  visitNumDone: { color: COLORS.success },
  visitDue: { fontSize: 9, color: COLORS.textHint, marginTop: 2 },
  flagItem: { fontSize: 12, color: COLORS.textSecondary, paddingLeft: spacing.sm },
});
