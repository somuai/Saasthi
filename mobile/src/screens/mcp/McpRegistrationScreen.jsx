import { useEffect, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDatabase } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import { useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { GovtHeader } from "../../components/GovtHeader";
import { GovtInput } from "../../components/GovtInput";
import { GovtButton } from "../../components/GovtButton";
import { ToggleRow } from "../../components/ToggleRow";
import { COLORS } from "../../constants/colors";
import { calculateEDD, isoFromDate } from "../../utils/mcpHelpers";
import { incrementPendingCount } from "../../features/sync/syncSlice";

function CompletionBar({ value }) {
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${value}%` }]} />
    </View>
  );
}

function SectionCard({ step, title, subtitle, children }) {
  return (
    <View style={styles.sectionCard}>
        <View style={styles.sectionHead}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>{step}</Text>
          </View>
          <View style={styles.sectionTitleWrap}>
          <Text style={styles.section} numberOfLines={2}>{title}</Text>
          {subtitle ? <Text style={styles.sectionHint}>{subtitle}</Text> : null}
          </View>
        </View>
      {children}
    </View>
  );
}

function safeEddFromLmp(lmpDate) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lmpDate || "")) return "";
  try {
    const edd = isoFromDate(calculateEDD(lmpDate));
    return edd === "Invalid Date" ? "" : edd;
  } catch {
    return "";
  }
}

export default function McpRegistrationScreen() {
  const { patientId } = useLocalSearchParams();
  const database = useDatabase();
  const router = useRouter();
  const dispatch = useDispatch();
  const [patients, setPatients] = useState([]);
  const [patient, setPatient] = useState(null);
  const [mother, setMother] = useState(null);
  const [mode, setMode] = useState("select");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);
  const [form, setForm] = useState({
    name: "",
    age: "",
    gender: "female",
    phone: "",
    village: "",
    patientCode: "",
    lmpDate: "",
    gravida: "1",
    prevLiveBirths: "0",
    fatherName: "",
    isHighRisk: false,
    isPmmvyEligible: false,
    bankName: "",
    bankAccount: "",
    bankIfsc: "",
    identifiedDeliveryInstitution: "",
    jsyRegistered: false,
  });

  const lmp = form.lmpDate;
  const edd = safeEddFromLmp(lmp);
  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (formError) setFormError(null);
  };
  const hasIdentity = patient ? Boolean(patient.name) : Boolean(form.name.trim());
  const requiredDone = [hasIdentity, Boolean(edd), Boolean(form.gravida.trim())].filter(Boolean).length;
  const completion = Math.round((requiredDone / 3) * 100);
  const canSave = hasIdentity && Boolean(edd) && Boolean(form.gravida.trim()) && !saving;

  useEffect(() => {
    if (patientId || mode !== "select") return undefined;
    const q = database.collections
      .get("patients")
      .query(Q.where("is_deleted", false));
    const sub = q.observe().subscribe(setPatients);
    return () => sub.unsubscribe();
  }, [database, patientId, mode]);

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
    if (!patient) return;
    setMode("form");
    setForm((prev) => ({
      ...prev,
      name: patient.name || prev.name,
      age: patient.age ? String(patient.age) : prev.age,
      gender: patient.gender || prev.gender,
      phone: patient.phone || prev.phone,
      patientCode: patient.patientCode || prev.patientCode,
    }));
  }, [patient]);

  useEffect(() => {
    if (!mother) return;
    setForm((prev) => ({
      ...prev,
      lmpDate: mother.lmpDate || prev.lmpDate,
      gravida: mother.gravida ? String(mother.gravida) : prev.gravida,
      prevLiveBirths: mother.prevLiveBirths ? String(mother.prevLiveBirths) : prev.prevLiveBirths,
      fatherName: mother.fatherName || prev.fatherName,
      isHighRisk: mother.isHighRisk || false,
      isPmmvyEligible: mother.isPmmvyEligible || false,
      bankName: mother.bankName || prev.bankName,
      bankAccount: mother.bankAccount || prev.bankAccount,
      bankIfsc: mother.bankIfsc || prev.bankIfsc,
      identifiedDeliveryInstitution: mother.identifiedDeliveryInstitution || prev.identifiedDeliveryInstitution,
      jsyRegistered: mother.jsyRegistered || false,
    }));
  }, [mother]);

  async function saveRegistration() {
    if (!canSave) {
      setFormError("नाम, सही LMP तिथि और गर्भ संख्या भरें / Fill name, valid LMP date and gravida.");
      return;
    }

    setSaving(true);
    setFormError(null);
    let savedPatientId = patient?.id;
    try {
      const now = Date.now();
      await database.write(async () => {
        let pat = patient;
        if (!pat) {
          pat = await database.collections.get("patients").create((p) => {
            p.name = form.name;
            p.age = form.age ? Number(form.age) : null;
            p.gender = form.gender;
            p.phone = form.phone;
            p.isPregnant = true;
            p.patientCode = form.patientCode || `MCP-${now}`;
            p.isSynced = false;
            p.createdAt = now;
            p.updatedAt = now;
            p.isDeleted = false;
            p.isMock = false;
          });
          savedPatientId = pat.id;
        } else {
          await pat.update((p) => {
            p.isPregnant = true;
            p.name = form.name || p.name;
            p.age = form.age ? Number(form.age) : p.age;
            p.phone = form.phone || p.phone;
            p.isSynced = false;
            p.updatedAt = now;
          });
          savedPatientId = pat.id;
        }

        const mr = mother || null;
        if (mr) {
          await mr.update((r) => {
            r.lmpDate = form.lmpDate || r.lmpDate;
            r.edd = lmp ? edd : r.edd;
            r.gravida = form.gravida ? Number(form.gravida) : r.gravida;
            r.prevLiveBirths = form.prevLiveBirths ? Number(form.prevLiveBirths) : r.prevLiveBirths;
            r.fatherName = form.fatherName || r.fatherName;
            r.isHighRisk = form.isHighRisk;
            r.isPmmvyEligible = form.isPmmvyEligible;
            r.bankName = form.bankName || r.bankName;
            r.bankAccount = form.bankAccount || r.bankAccount;
            r.bankIfsc = form.bankIfsc || r.bankIfsc;
            r.identifiedDeliveryInstitution = form.identifiedDeliveryInstitution || r.identifiedDeliveryInstitution;
            r.jsyRegistered = form.jsyRegistered;
            r.isSynced = false;
            r.updatedAt = now;
          });
        } else {
          await database.collections.get("mother_records").create((r) => {
            r.patientId = pat.id;
            r.lmpDate = form.lmpDate || "";
            r.edd = lmp ? edd : "";
            r.gravida = form.gravida ? Number(form.gravida) : 1;
            r.prevLiveBirths = form.prevLiveBirths ? Number(form.prevLiveBirths) : 0;
            r.fatherName = form.fatherName || "";
            r.isHighRisk = form.isHighRisk;
            r.isPmmvyEligible = form.isPmmvyEligible;
            r.bankName = form.bankName || "";
            r.bankAccount = form.bankAccount || "";
            r.bankIfsc = form.bankIfsc || "";
            r.identifiedDeliveryInstitution = form.identifiedDeliveryInstitution || "";
            r.jsyRegistered = form.jsyRegistered;
            r.isSynced = false;
            r.createdAt = now;
            r.updatedAt = now;
            r.isDeleted = false;
            r.isMock = false;
          });
        }

        dispatch(incrementPendingCount(patient ? 1 : 2));
      });

      router.replace({ pathname: "/(tabs)/mcp/dashboard", params: { patientId: savedPatientId } });
    } catch (e) {
      setFormError(e?.message || "MCP registration could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (mode === "select" && !patientId) {
    return (
      <View style={styles.page}>
        <GovtHeader titleHi="MCP पंजीकरण" title="MCP Registration" showSync />
        <FlatList
          data={patients}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.pickList}
          ListHeaderComponent={
            <View>
              <View style={styles.onboardHero}>
                <View style={styles.heroIcon}>
                  <Ionicons name="clipboard" size={24} color={COLORS.primary} />
                </View>
                <View style={styles.heroText}>
                  <Text style={styles.heroTitle}>Start MCP in two taps</Text>
                  <Text style={styles.heroSubtitle}>
                    पहले मौजूदा मरीज चुनें, या नया गर्भवती रिकॉर्ड बनाएं।
                  </Text>
                </View>
              </View>
              <Pressable style={styles.newBtn} onPress={() => setMode("form")}>
                <Ionicons name="add-circle" size={22} color="#fff" />
                <View>
                  <Text style={styles.newBtnText}>नया MCP रिकॉर्ड</Text>
                  <Text style={styles.newBtnSub}>Create new pregnancy record</Text>
                </View>
              </Pressable>
              <Text style={styles.listTitle}>मौजूदा मरीज / Existing records</Text>
            </View>
          }
          ListEmptyComponent={<Text style={styles.emptyPick}>कोई मरीज नहीं — नया रिकॉर्ड बनाएं</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.pick} onPress={() => router.setParams({ patientId: item.id })}>
              <View style={styles.pickAvatar}>
                <Text style={styles.pickAvatarText}>{(item.name || "?").slice(0, 1).toUpperCase()}</Text>
              </View>
              <View style={styles.pickBody}>
                <Text style={styles.pickName}>{item.name}</Text>
                <Text style={styles.pickMeta}>{item.patientCode || "No code"} · {item.age || "?"} yrs</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textHint} />
            </Pressable>
          )}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
    >
      <GovtHeader
        titleHi="MCP पंजीकरण"
        title={patient ? patient.name : "New registration"}
        showBack
        showSync
      />
      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.formIntro}>
          <View style={styles.formIntroRow}>
            <View style={styles.formIntroCopy}>
              <Text style={styles.formIntroTitle}>MCP onboarding</Text>
              <Text style={styles.formIntroSub}>Required: name, LMP date, gravida</Text>
            </View>
            <Text style={styles.formIntroPct}>{completion}%</Text>
          </View>
          <CompletionBar value={completion} />
          {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
        </View>

        <SectionCard
          step="1"
          title="Patient Details / मरीज विवरण"
          subtitle={patient ? "Existing patient selected" : "Create the mother profile first"}
        >
        {!patient ? (
          <>
            <GovtInput labelHi="नाम" label="Name" value={form.name} onChangeText={(t) => setField("name", t)} required />
            <GovtInput labelHi="उम्र" label="Age (years)" value={form.age} onChangeText={(t) => setField("age", t)} keyboardType="number-pad" />
            <GovtInput labelHi="फ़ोन" label="Phone" value={form.phone} onChangeText={(t) => setField("phone", t)} keyboardType="phone-pad" />
            <GovtInput labelHi="कोड" label="Patient code" value={form.patientCode} onChangeText={(t) => setField("patientCode", t)} placeholder="Auto-created if blank" />
          </>
        ) : (
          <View style={styles.selectedPatient}>
            <Text style={styles.pickName}>{patient.name}</Text>
            <Text style={styles.pickMeta}>{patient.patientCode || "No code"} · {patient.age || "?"} yrs</Text>
          </View>
        )}
        </SectionCard>

        <SectionCard
          step="2"
          title="Pregnancy / गर्भावस्था"
          subtitle="Use YYYY-MM-DD so EDD is calculated automatically"
        >
        <GovtInput labelHi="LMP तिथि" label="LMP date (YYYY-MM-DD)" value={form.lmpDate} onChangeText={(t) => setField("lmpDate", t)} required placeholder="2026-05-22" />
        {lmp ? <Text style={styles.meta}>{edd ? `EDD: ${edd}` : "Enter a complete date: YYYY-MM-DD"}</Text> : null}
        <GovtInput labelHi="गर्भ संख्या" label="Gravida" value={form.gravida} onChangeText={(t) => setField("gravida", t)} keyboardType="number-pad" required />
        <GovtInput labelHi="पिछले जीवित जन्म" label="Previous live births" value={form.prevLiveBirths} onChangeText={(t) => setField("prevLiveBirths", t)} keyboardType="number-pad" />
        <GovtInput labelHi="पिता का नाम" label="Father's name" value={form.fatherName} onChangeText={(t) => setField("fatherName", t)} />
        <ToggleRow labelHi="उच्च जोखिम" labelEn="High risk" value={form.isHighRisk} onChange={(v) => setField("isHighRisk", v)} />
        </SectionCard>

        <SectionCard
          step="3"
          title="Benefits / योजना"
          subtitle="Capture JSY, PMMVY and bank details only if available"
        >
        <ToggleRow labelHi="JSY पंजीकृत" labelEn="JSY registered" value={form.jsyRegistered} onChange={(v) => setField("jsyRegistered", v)} />
        <ToggleRow labelHi="PMMVY पात्र" labelEn="PMMVY eligible" value={form.isPmmvyEligible} onChange={(v) => setField("isPmmvyEligible", v)} />
        <GovtInput labelHi="बैंक नाम" label="Bank name" value={form.bankName} onChangeText={(t) => setField("bankName", t)} />
        <GovtInput labelHi="खाता संख्या" label="Account number" value={form.bankAccount} onChangeText={(t) => setField("bankAccount", t)} keyboardType="number-pad" />
        <GovtInput labelHi="IFSC कोड" label="IFSC code" value={form.bankIfsc} onChangeText={(t) => setField("bankIfsc", t.toUpperCase())} autoCapitalize="characters" />
        </SectionCard>

        <SectionCard
          step="4"
          title="Delivery Plan / प्रसव योजना"
          subtitle="This helps follow-up and referral planning"
        >
        <GovtInput labelHi="चिन्हित संस्था" label="Identified delivery institution" value={form.identifiedDeliveryInstitution} onChangeText={(t) => setField("identifiedDeliveryInstitution", t)} />
        <GovtButton titleHi="पंजीकरण सहेजें" titleEn="Save registration" onPress={saveRegistration} loading={saving} disabled={!canSave} />
        </SectionCard>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  scrollContainer: { flex: 1 },
  scroll: { flexGrow: 1, padding: 14, paddingBottom: 96 },
  pickList: { padding: 14, paddingBottom: 96 },
  onboardHero: {
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    padding: 14,
    marginBottom: 12,
  },
  heroIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: COLORS.navyLight,
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: { flex: 1, minWidth: 0 },
  heroTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: "900" },
  heroSubtitle: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4 },
  listTitle: { color: COLORS.textPrimary, fontSize: 13, fontWeight: "900", marginTop: 16, marginBottom: 8 },
  emptyPick: {
    color: COLORS.textSecondary,
    textAlign: "center",
    paddingVertical: 28,
  },
  newBtn: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.accent,
    borderRadius: 8,
  },
  newBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  newBtnSub: { color: "rgba(255,255,255,0.86)", fontSize: 11, marginTop: 2 },
  muted: { color: COLORS.textSecondary },
  pick: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  pickAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.navyLight,
    alignItems: "center",
    justifyContent: "center",
  },
  pickAvatarText: { color: COLORS.primary, fontWeight: "900" },
  pickBody: { flex: 1, minWidth: 0 },
  pickName: { fontWeight: "900", color: COLORS.textPrimary, fontSize: 15 },
  pickMeta: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  selectedPatient: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.navyLight,
    padding: 12,
  },
  formIntro: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    padding: 14,
    marginBottom: 12,
  },
  formIntroRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  formIntroCopy: { flex: 1, minWidth: 0 },
  formIntroTitle: { color: COLORS.textPrimary, fontSize: 17, fontWeight: "900" },
  formIntroSub: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
  formIntroPct: { color: COLORS.primary, fontSize: 18, fontWeight: "900" },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.surfaceContainerLow,
    overflow: "hidden",
    marginTop: 12,
  },
  progressFill: { height: "100%", backgroundColor: COLORS.accent },
  sectionCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    padding: 12,
    marginBottom: 12,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  stepBadgeText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  sectionTitleWrap: { flex: 1, minWidth: 0 },
  section: {
    fontSize: 15,
    fontWeight: "900",
    color: COLORS.primary,
  },
  sectionHint: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  meta: {
    color: COLORS.primary,
    backgroundColor: COLORS.navyLight,
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    fontWeight: "800",
  },
  errorText: { color: COLORS.danger, fontSize: 12, fontWeight: "800", marginTop: 8 },
});
