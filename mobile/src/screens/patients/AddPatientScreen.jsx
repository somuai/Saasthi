import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useDatabase } from "@nozbe/watermelondb/react";
import { useDispatch, useSelector } from "react-redux";
import * as Location from "expo-location";
import { ErrorState } from "../../components/ErrorState";
import { GovtHeader } from "../../components/GovtHeader";
import { GovtInput } from "../../components/GovtInput";
import { ToggleRow } from "../../components/ToggleRow";
import { COLORS } from "../../constants/colors";
import { todayYmd } from "../../utils/dateHelpers";
import { scorePatient } from "../../ml/riskScorer";
import { incrementPendingCount } from "../../features/sync/syncSlice";
import { getWorkerServerId } from "../../utils/workerId";
import { translateHindiText, useLocale } from "../../utils/localization";
import { logger } from "../../utils/logger";

const steps = ["पहचान / Identity", "चिकित्सा / Medical", "परिवार / Household"];

export default function AddPatientScreen() {
  const database = useDatabase();
  const router = useRouter();
  const locale = useLocale();
  const dispatch = useDispatch();
  const auth = useSelector((s) => s.auth);
  const workerServerId = getWorkerServerId(auth);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (!granted) return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCoords({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
        });
      } catch (e) {
        logger.debug("[AddPatientScreen] Location unavailable", e?.message || e);
      }
    })();
  }, []);

  const [form, setForm] = useState({
    name: "",
    age: "",
    gender: null,
    phone: "",
    hasDiabetes: null,
    hasHypertension: null,
    isPregnant: null,
    hospitalizedLastYear: null,
    regularMedicines: null,
    medicinesName: "",
    village: "",
    headOfFamily: "",
    consent: true,
  });

  function next() {
    if (step === 0) {
      if (!form.name || !form.age || form.gender == null) return;
    }
    if (step === 1) {
      if (
        [form.hasDiabetes, form.hasHypertension, form.isPregnant, form.hospitalizedLastYear, form.regularMedicines].some((x) => x === null)
      )
        return;
    }
    setStep((s) => Math.min(2, s + 1));
  }

  async function save() {
    if (!form.headOfFamily && !form.village) return;
    setSaving(true);
    let newPatientId;
    try {
      await database.write(async () => {
        const now = Date.now();
        const hh = await database.collections.get("households").create((h) => {
          h.householdCode = `HH-${now.toString(36)}`;
          h.headOfFamily = form.headOfFamily || form.name;
          h.village = form.village;
          if (workerServerId) h.ashaWorkerId = workerServerId;
          if (coords) {
            h.gpsLat = coords.latitude;
            h.gpsLng = coords.longitude;
          }
          h.isSynced = false;
          h.isDeleted = false;
          h.isMock = false;
          h.createdAt = now;
          h.updatedAt = now;
        });
        const risk = scorePatient(
          {
            age: Number(form.age),
            isPregnant: form.isPregnant,
            hasDiabetes: form.hasDiabetes,
            hasHypertension: form.hasHypertension,
            hospitalizedLastYear: form.hospitalizedLastYear,
          },
          null,
          null,
        );
        const patient = await database.collections.get("patients").create((p) => {
          p.patientCode = `P-${now.toString(36)}`;
          p.householdId = hh.id;
          p.name = form.name;
          p.age = Number(form.age);
          p.gender = form.gender;
          p.phone = form.phone;
          p.hasDiabetes = form.hasDiabetes;
          p.hasHypertension = form.hasHypertension;
          p.isPregnant = form.isPregnant;
          p.hospitalizedLastYear = form.hospitalizedLastYear;
          p.regularMedicines = form.regularMedicines;
          p.medicinesName = form.medicinesName;
          p.riskScore = risk.score;
          p.riskLevel = risk.riskLevel;
          p.lastVisited = todayYmd();
          if (workerServerId) p.ashaWorkerServerId = workerServerId;
          p.isSynced = false;
          p.isDeleted = false;
          p.isMock = false;
          p.createdAt = now;
          p.updatedAt = now;
        });
        newPatientId = patient.id;
        await database.collections.get("incentive_records").create((ir) => {
          ir.actionType = "PATIENT_REGISTER";
          ir.patientId = patient.id;
          ir.points = 5;
          ir.amountInr = 1;
          ir.periodDate = todayYmd();
          ir.isApproved = false;
          ir.isSynced = false;
          ir.isDeleted = false;
          ir.isMock = false;
          ir.createdAt = now;
          ir.updatedAt = now;
        });
      });
      dispatch(incrementPendingCount(3));
      router.replace(`/(tabs)/patients/${newPatientId}`);
    } catch (e) {
      setError(e?.message || "Failed to save patient");
    } finally {
      setSaving(false);
    }
  }

  const currentRisk = scorePatient(
    {
      age: Number(form.age) || 0,
      isPregnant: form.isPregnant,
      hasDiabetes: form.hasDiabetes,
      hasHypertension: form.hasHypertension,
      hospitalizedLastYear: form.hospitalizedLastYear,
    },
    null,
    null,
  );
  const isHighRisk = currentRisk.riskLevel === "high" || currentRisk.riskLevel === "critical";
  const headerBgColor = isHighRisk ? "#D32F2F" : COLORS.matriMaAccent;
  const pageBg = isHighRisk ? COLORS.background : COLORS.matriMaBg;

  if (error) {
    return (
      <View style={styles.page}>
        <ErrorState message={error} onRetry={() => setError(null)} />
      </View>
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: pageBg }, isHighRisk && { borderWidth: 3, borderColor: "#D32F2F" }]}>
      <GovtHeader titleHi="मरीज जोड़ें" title="Add Patient" showBack showSync backgroundColor={headerBgColor} />
      <View style={styles.steps}>
        {steps.map((label, i) => (
          <View key={label} style={styles.stepDotRow}>
            <View style={[styles.circle, i <= step ? styles.circleOn : styles.circleOff]}>
              <Text style={styles.circleTxt}>{i + 1}</Text>
            </View>
            {i < 2 ? <View style={styles.line} /> : null}
          </View>
        ))}
      </View>
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scroll}>
        {step === 0 ? (
          <>
            <GovtInput
              labelHi="पूरा नाम"
              labelEn="Full Name"
              required
              value={form.name}
              onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
            />
            <GovtInput
              labelHi="उम्र"
              labelEn="Age"
              required
              value={form.age}
              onChangeText={(t) => setForm((f) => ({ ...f, age: t }))}
              keyboardType="numeric"
            />
            <Text style={styles.label}>{locale === "en" ? "Gender *" : `${translateHindiText("लिंग", locale)} / Gender *`}</Text>
            <View style={styles.row}>
              {["M", "F", "O"].map((g) => (
                <Pressable
                  key={g}
                  style={[styles.gender, form.gender === g && styles.genderOn]}
                  onPress={() => setForm((f) => ({ ...f, gender: g }))}
                >
                  <Text style={[styles.genderTxt, form.gender === g && { color: "#fff" }]}>
                    {g === "M"
                      ? locale === "en"
                        ? "Male"
                        : translateHindiText("पुरुष", locale)
                      : g === "F"
                        ? locale === "en"
                          ? "Female"
                          : translateHindiText("महिला", locale)
                        : locale === "en"
                          ? "Other"
                          : translateHindiText("अन्य", locale)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <GovtInput
              labelHi="मोबाइल"
              labelEn="Phone"
              value={form.phone}
              onChangeText={(t) => setForm((f) => ({ ...f, phone: t }))}
              keyboardType="phone-pad"
              prefix="+91"
            />
          </>
        ) : null}
        {step === 1 ? (
          <>
            <ToggleRow
              labelHi="मधुमेह"
              labelEn="Diabetes"
              value={form.hasDiabetes}
              onChange={(v) => setForm((f) => ({ ...f, hasDiabetes: v }))}
            />
            <ToggleRow
              labelHi="उच्च रक्तचाप"
              labelEn="Hypertension"
              value={form.hasHypertension}
              onChange={(v) => setForm((f) => ({ ...f, hasHypertension: v }))}
            />
            <ToggleRow
              labelHi="गर्भवती?"
              labelEn="Pregnant?"
              value={form.isPregnant}
              onChange={(v) => setForm((f) => ({ ...f, isPregnant: v }))}
            />
            <ToggleRow
              labelHi="पिछले साल अस्पताल?"
              labelEn="Hospitalized last year?"
              value={form.hospitalizedLastYear}
              onChange={(v) => setForm((f) => ({ ...f, hospitalizedLastYear: v }))}
            />
            <ToggleRow
              labelHi="नियमित दवाई?"
              labelEn="Regular medicines?"
              value={form.regularMedicines}
              onChange={(v) => setForm((f) => ({ ...f, regularMedicines: v }))}
            />
            {form.regularMedicines ? (
              <GovtInput
                labelHi="दवाई"
                labelEn="Medicine name"
                value={form.medicinesName}
                onChangeText={(t) => setForm((f) => ({ ...f, medicinesName: t }))}
              />
            ) : null}
          </>
        ) : null}
        {step === 2 ? (
          <>
            {coords ? (
              <Text style={{ color: COLORS.success, fontSize: 13, marginBottom: 12, fontWeight: "700", textAlign: "center" }}>
                📍{" "}
                {locale === "en"
                  ? `Location captured (±${Math.round(coords.accuracy || 10)}m)`
                  : `${translateHindiText("स्थान मिल गया", locale)} (±${Math.round(coords.accuracy || 10)}m)`}
              </Text>
            ) : (
              <Text style={{ color: COLORS.warning, fontSize: 13, marginBottom: 12, fontWeight: "700", textAlign: "center" }}>
                📍 {locale === "en" ? "Getting location..." : translateHindiText("स्थान खोज रहे हैं...", locale)}
              </Text>
            )}
            <GovtInput labelHi="गांव" labelEn="Village" value={form.village} onChangeText={(t) => setForm((f) => ({ ...f, village: t }))} />
            <GovtInput
              labelHi="परिवार प्रमुख"
              labelEn="Head of family"
              value={form.headOfFamily}
              onChangeText={(t) => setForm((f) => ({ ...f, headOfFamily: t }))}
            />
            <ToggleRow
              labelHi="সরাসরি মৌখিক সম্মতি / Oral Consent"
              labelEn="Consent Verified / সম্মতি নেওয়া হয়েছে"
              value={form.consent}
              onChange={(v) => setForm((f) => ({ ...f, consent: v }))}
            />
            <View style={styles.consentNotice}>
              <Text style={styles.consentNoticeTxt}>
                By enabling, you verify that the patient has provided affirmative oral consent for collecting health data (identity, medical
                history, pregnancy status, and GPS coordinates) to coordinate care under the Digital Personal Data Protection (DPDP) Act
                2023. The patient can withdraw consent at any time.
              </Text>
              <Text style={[styles.consentNoticeTxt, { marginTop: 4 }]}>
                এটি চালু করে, আপনি নিশ্চিত করছেন যে রোগী ডিজিটাল পার্সোনাল ডেটা প্রোটেকশন (ডিপিডিপি) আইন ২০২৩ এর অধীনে কেয়ার কোঅর্ডিনেশনের
                জন্য স্বাস্থ্য সংক্রান্ত তথ্য (পরিচয়, চিকিৎসাগত ইতিহাস, গর্ভাবস্থার স্থিতি এবং জিপিএস স্থানাঙ্ক) সংগ্রহের জন্য ইতিবাচক মৌখিক
                সম্মতি দিয়েছেন। রোগী যেকোনো সময় এই সম্মতি প্রত্যাহার করতে পারেন।
              </Text>
            </View>
          </>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable style={styles.backBtn} onPress={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
          <Text style={styles.backTxt}>{locale === "en" ? "Back" : translateHindiText("वापस", locale)}</Text>
        </Pressable>
        <Pressable style={styles.nextBtn} onPress={step < 2 ? next : save} disabled={saving}>
          <Text style={styles.nextTxt}>
            {step < 2
              ? locale === "en"
                ? "Next"
                : translateHindiText("आगे", locale)
              : saving
                ? "…"
                : locale === "en"
                  ? "Save"
                  : translateHindiText("सहेजें", locale)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  scrollContainer: { flex: 1 },
  scroll: { flexGrow: 1, padding: 16 },
  steps: { flexDirection: "row", justifyContent: "center", paddingVertical: 12 },
  stepDotRow: { flexDirection: "row", alignItems: "center" },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  circleOn: { backgroundColor: COLORS.primary },
  circleOff: { borderWidth: 2, borderColor: COLORS.border },
  circleTxt: { color: "#fff", fontWeight: "800", fontSize: 12 },
  line: { width: 40, height: 2, backgroundColor: COLORS.border },
  stepLabel: { textAlign: "center", fontWeight: "700", color: COLORS.textPrimary },
  label: { fontSize: 14, fontWeight: "700", marginBottom: 8, color: COLORS.textPrimary },
  row: { flexDirection: "row", gap: 8, marginBottom: 16 },
  gender: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  genderOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  genderTxt: { fontSize: 13, fontWeight: "700", color: COLORS.textSecondary },
  footer: { flexDirection: "row", gap: 12, padding: 16, borderTopWidth: 1, borderColor: COLORS.border },
  backBtn: {
    flex: 1,
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  backTxt: { fontWeight: "700", color: COLORS.textSecondary },
  nextBtn: { flex: 1, minHeight: 52, borderRadius: 8, backgroundColor: COLORS.accent, alignItems: "center", justifyContent: "center" },
  nextTxt: { color: "#fff", fontWeight: "800", fontSize: 16 },
  consentNotice: {
    backgroundColor: "rgba(65, 108, 175, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(65, 108, 175, 0.15)",
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    marginBottom: 16,
  },
  consentNoticeTxt: {
    fontSize: 11,
    lineHeight: 14,
    color: COLORS.textSecondary,
  },
});
