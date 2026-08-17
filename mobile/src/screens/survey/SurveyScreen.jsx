import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LottieWrapper } from "../../components/LottieWrapper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDatabase } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import { useDispatch, useSelector } from "react-redux";
import { GovtHeader } from "../../components/GovtHeader";
import { GovtButton } from "../../components/GovtButton";
import { SymptomCard } from "../../components/SymptomCard";
import { ToggleRow } from "../../components/ToggleRow";
import { RiskBadge } from "../../components/RiskBadge";
import { GovtInput } from "../../components/GovtInput";
import { COLORS } from "../../constants/colors";
import { scorePatient } from "../../ml/riskScorer";
import { ensureModelLoaded, scoreWithBestAvailable } from "../../ml/riskEngine";
import { todayYmd } from "../../utils/dateHelpers";
import { incrementPendingCount } from "../../features/sync/syncSlice";
import { getWorkerServerId } from "../../utils/workerId";
import {
  VISIT_TYPES,
  buildSurveyPayload,
  computeSubmitSideEffects,
  emptySurveyForm,
  prefillHistoryFromPatient,
  symptomJson,
} from "./surveySubmit";
import { draftKey, mergeDraftOrPrefill } from "./surveyDraft";
import { useLocale, translateHindiText } from "../../utils/localization";
import { logger } from "../../utils/logger";

const STEPS = [
  "Consent / सहमति",
  "Observation / अवलोकन",
  "History / इतिहास",
  "Symptoms / लक्षण",
  "Serious / गंभीर",
  "Chronic & infectious / जीर्ण व संक्रामक",
  "Review / समीक्षा",
];

const EMERGENCY_NUMBERS = [
  { label: "108 Ambulance", tel: "108" },
  { label: "102 Janani", tel: "102" },
];

export default function SurveyScreen() {
  const { patientId } = useLocalSearchParams();
  const database = useDatabase();
  const dispatch = useDispatch();
  const auth = useSelector((s) => s.auth);
  const workerServerId = getWorkerServerId(auth);
  const router = useRouter();
  const [patient, setPatient] = useState(null);
  const [mother, setMother] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(emptySurveyForm);
  const [seriousModal, setSeriousModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [successParams, setSuccessParams] = useState(null);
  const locale = useLocale();
  const hiText = (hi) => (locale === "en" ? hi : translateHindiText(hi, locale));

  const patch = useCallback((partial) => setForm((f) => ({ ...f, ...partial })), []);

  useEffect(() => {
    if (!patientId) return undefined;
    const q = database.collections.get("patients").query(Q.where("id", patientId));
    const sub = q.observe().subscribe((r) => setPatient(r[0] || null));
    return () => sub.unsubscribe();
  }, [database, patientId]);

  useEffect(() => {
    if (!patient?.id) return undefined;
    const mq = database.collections.get("mother_records").query(Q.where("patient_id", patient.id), Q.where("is_deleted", false));
    const sub = mq.observe().subscribe((recs) => setMother(recs[0] || null));
    return () => sub.unsubscribe();
  }, [database, patient]);

  useEffect(() => {
    if (!patient?.id || !patientId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(draftKey(patientId));
        if (cancelled) return;
        setForm(mergeDraftOrPrefill(raw, patient, emptySurveyForm, prefillHistoryFromPatient));
      } catch {
        if (!cancelled) {
          setForm(mergeDraftOrPrefill(null, patient, emptySurveyForm, prefillHistoryFromPatient));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [patient, patientId]);

  useEffect(() => {
    if (!patientId) return undefined;
    const t = setTimeout(() => {
      AsyncStorage.setItem(draftKey(patientId), JSON.stringify(form)).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [form, patientId]);

  const surveyForScore = useMemo(() => buildSurveyPayload(form), [form]);

  const pNorm = patient
    ? {
        age: patient.age,
        isPregnant: patient.isPregnant,
        hasDiabetes: patient.hasDiabetes,
        hasHypertension: patient.hasHypertension,
        hasTb: patient.hasTb,
        hasHeartDisease: patient.hasHeartDisease,
        hospitalizedLastYear: form.hospitalizedLastYear ?? patient.hospitalizedLastYear,
        immunizationDefaulter: patient.immunizationDefaulter,
        latestWeightForAgeZ: patient.latestWeightForAgeZ,
        lastVisited: patient.lastVisited,
      }
    : {};

  const mcpData = mother
    ? {
        isHighRisk: mother.isHighRisk,
        ancVisitCount: [
          mother.ancVisit1Json,
          mother.ancVisit2Json,
          mother.ancVisit3Json,
          mother.ancVisit4Json,
          mother.ancVisit5Json,
        ].filter((j) => j && String(j).length > 2).length,
      }
    : null;

  const riskResult = scorePatient(pNorm, surveyForScore, mcpData);
  const risk = {
    riskLevel: riskResult.riskLevel,
    score: riskResult.score,
    riskLevelHi: riskResult.riskLevelHi,
    riskColor: riskResult.riskColor,
  };

  const hasSerious = form.seriousBreathing || form.seriousChestPain || form.seriousUnableWalk || form.seriousPregnancyComp;

  useEffect(() => {
    if (stepIndex === 4 && hasSerious) setSeriousModal(true);
  }, [stepIndex, hasSerious]);

  useEffect(() => {
    ensureModelLoaded().catch((err) => {
      logger.warn("Model preload failed:", err?.message || err);
    });
  }, []);

  async function finish() {
    if (!patient || !form.consent) return;
    setSaving(true);
    const r = await scoreWithBestAvailable(pNorm, surveyForScore, mcpData);
    const sideFx = computeSubmitSideEffects(form, r, patient);
    const now = Date.now();
    const day = todayYmd();
    let survey;
    try {
      await database.write(async () => {
        survey = await database.collections.get("survey_responses").create((s) => {
          s.patientId = patient.id;
          if (workerServerId) s.ashaWorkerServerId = workerServerId;
          s.surveyDate = day;
          s.visitType = form.visitType || "first";
          s.consentAccepted = form.consent;
          s.consentVersion = "pilot-v1";
          s.ashaObservation = form.ashaObservation || null;
          s.livingCondition = form.livingCondition;
          s.healthcareAccess = form.healthcareAccess;
          s.symptomFeverJson = symptomJson(form.fever);
          s.symptomCoughJson = symptomJson(form.cough);
          s.symptomBreathlessJson = symptomJson(form.breathless);
          s.symptomChestPainJson = symptomJson(form.chestPainSym);
          s.symptomWeaknessJson = symptomJson(form.weakness);
          s.symptomDiarrheaJson = symptomJson(form.diarrhea);
          s.symptomVomitingJson = symptomJson(form.vomiting);
          s.seriousSevereBreathing = form.seriousBreathing;
          s.seriousChestPain = form.seriousChestPain;
          s.seriousUnableWalk = form.seriousUnableWalk;
          s.seriousPregnancyComp = form.seriousPregnancyComp;
          s.chronicFreqUrination = form.chronicFreqUrination;
          s.chronicExcessThirst = form.chronicExcessThirst;
          s.chronicJointPain = form.chronicJointPain;
          s.chronicKnownBpDm = form.chronicKnownBpDm;
          s.commCough2weeks = form.commCough2weeks;
          s.commFever3days = form.commFever3days;
          s.commInfectionWounds = form.commInfectionWounds;
          s.commContactSick = form.commContactSick;
          s.computedRiskScore = r.score;
          s.computedRiskLevel = r.riskLevel;
          s.triggeredFactorsJson = JSON.stringify(r.triggeredFactors);
          s.mlModelVersion = r.modelVersion;
          s.isComplete = true;
          s.isSynced = false;
          s.isDeleted = false;
          s.isMock = false;
          s.createdAt = now;
          s.updatedAt = now;
        });

        await patient.update((p) => {
          p.riskScore = r.score;
          p.riskLevel = r.riskLevel;
          p.lastVisited = day;
          p.hospitalizedLastYear = form.hospitalizedLastYear;
          p.regularMedicines = form.regularMedicines;
          p.medicinesName = form.medicinesName || null;
          p.isSynced = false;
          p.updatedAt = now;
        });

        for (const flag of sideFx.flags) {
          await database.collections.get("flags").create((f) => {
            f.patientId = patient.id;
            if (workerServerId) f.ashaWorkerServerId = workerServerId;
            f.flagType = flag.flagType;
            f.severity = flag.severity;
            f.description = flag.description;
            f.isResolved = false;
            f.isSynced = false;
            f.isDeleted = false;
            f.isMock = false;
            f.createdAt = now;
            f.updatedAt = now;
          });
        }

        for (const fu of sideFx.followUps) {
          const due = new Date();
          due.setDate(due.getDate() + fu.daysOffset);
          await database.collections.get("follow_ups").create((f) => {
            f.patientId = patient.id;
            f.surveyId = survey.id;
            f.dueDate = due.toISOString().slice(0, 10);
            f.isCompleted = false;
            f.isOverdue = false;
            f.followType = fu.followType;
            f.isSynced = false;
            f.isDeleted = false;
            f.isMock = false;
            f.createdAt = now;
            f.updatedAt = now;
          });
        }

        await database.collections.get("incentive_records").create((ir) => {
          ir.actionType = "SURVEY_COMPLETE";
          ir.patientId = patient.id;
          ir.referenceId = survey.id;
          ir.points = 10;
          ir.amountInr = 2;
          ir.periodDate = day;
          ir.isApproved = false;
          ir.isSynced = false;
          ir.isDeleted = false;
          ir.isMock = false;
          ir.createdAt = now;
          ir.updatedAt = now;
        });
      });
      await AsyncStorage.removeItem(draftKey(patient.id));
      dispatch(incrementPendingCount(5));
      setSuccessParams({
        pathname: "/(tabs)/survey/result",
        params: {
          patientId: patient.id,
          patientName: patient.name,
          patientAge: patient.age != null ? String(patient.age) : "",
          patientGender: patient.gender || "",
          score: String(r.score),
          riskLevel: r.riskLevel,
          factors: JSON.stringify(r.triggeredFactors || []),
          primaryCategory: r.primaryCategory,
          recEn: r.recommendation.en,
          recHi: r.recommendation.hi,
          recUrgency: r.recommendation.urgency,
          recommendationSource: r.modelSource || r.recommendationSource || "rule_template",
          surveyLocalId: survey.id,
        },
      });
      setShowSuccessOverlay(true);
    } catch (e) {
      Alert.alert("Save failed", e?.message || "Could not save survey. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!patient) {
    return (
      <View style={styles.page}>
        <GovtHeader titleHi="सर्वे" title="Survey" showBack showSync />
        <Text style={styles.muted}>{hiText("Patient not found / मरीज नहीं मिला")}</Text>
      </View>
    );
  }

  const isHighRisk = risk.riskLevel === "high" || risk.riskLevel === "critical";
  const headerBgColor = isHighRisk ? "#D32F2F" : COLORS.matriMaAccent;
  const pageBg = isHighRisk ? COLORS.background : COLORS.matriMaBg;

  return (
    <View style={[styles.page, { backgroundColor: pageBg }, isHighRisk && { borderWidth: 3, borderColor: "#D32F2F" }]}>
      <GovtHeader
        titleHi="सर्वे"
        title={patient.name}
        showBack
        showSync
        backgroundColor={headerBgColor}
        rightComponent={
          <Pressable onPress={() => AsyncStorage.setItem(draftKey(patient.id), JSON.stringify(form))} style={styles.draftBtn}>
            <Text style={styles.draftTxt}>Draft</Text>
          </Pressable>
        }
      />
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.stepRow}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.stepDot, i <= stepIndex && styles.stepDotOn]} />
          ))}
        </View>
        <Text style={styles.step}>
          Step {stepIndex + 1}/{STEPS.length}: {hiText(STEPS[stepIndex])}
        </Text>

        {stepIndex === 0 ? (
          <>
            <ToggleRow
              labelHi="সরাসরি মৌখিক সম্মতি / Oral Consent"
              labelEn="Consent Verified / সম্মতি নেওয়া হয়েছে"
              value={form.consent}
              onChange={(v) => patch({ consent: v })}
              required
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
            <Text style={styles.label}>{hiText("भेंट प्रकार / Visit type")}</Text>
            <View style={styles.row}>
              {VISIT_TYPES.map((vt) => (
                <Pressable
                  key={vt.key}
                  style={[styles.chip, form.visitType === vt.key && styles.chipOn]}
                  onPress={() => patch({ visitType: vt.key })}
                >
                  <Text style={[styles.chipTxt, form.visitType === vt.key && styles.chipTxtOn]}>{hiText(vt.hi)}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {stepIndex === 1 ? (
          <>
            <GovtInput
              labelHi="ASHA अवलोकन"
              labelEn="ASHA observation"
              value={form.ashaObservation}
              onChangeText={(t) => patch({ ashaObservation: t })}
              multiline
            />
            <Text style={styles.label}>{hiText("रहन-सहन / Living condition")}</Text>
            <View style={styles.row}>
              {["clean", "moderate", "poor"].map((k) => (
                <Pressable
                  key={k}
                  style={[styles.chip, form.livingCondition === k && styles.chipOn]}
                  onPress={() => patch({ livingCondition: k })}
                >
                  <Text style={[styles.chipTxt, form.livingCondition === k && styles.chipTxtOn]}>{k}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.label}>{hiText("स्वास्थ्य पहुंच / Healthcare access")}</Text>
            <View style={styles.row}>
              {["easy", "difficult"].map((k) => (
                <Pressable
                  key={k}
                  style={[styles.chip, form.healthcareAccess === k && styles.chipOn]}
                  onPress={() => patch({ healthcareAccess: k })}
                  accessibilityRole="button"
                >
                  <Text style={[styles.chipTxt, form.healthcareAccess === k && styles.chipTxtOn]}>{k}</Text>
                </Pressable>
              ))}
            </View>
            <GovtInput
              labelHi="ऊंचाई (cm)"
              labelEn="Height cm"
              value={form.heightCm}
              onChangeText={(t) => patch({ heightCm: t })}
              keyboardType="decimal-pad"
            />
            <GovtInput
              labelHi="वजन (kg)"
              labelEn="Weight kg"
              value={form.weightKg}
              onChangeText={(t) => patch({ weightKg: t })}
              keyboardType="decimal-pad"
            />
            <GovtInput
              labelHi="Hb (g/dl)"
              labelEn="Hemoglobin"
              value={form.hemoglobin}
              onChangeText={(t) => patch({ hemoglobin: t })}
              keyboardType="decimal-pad"
            />
            <GovtInput
              labelHi="BP systolic"
              labelEn="BP systolic"
              value={form.systolicBp}
              onChangeText={(t) => patch({ systolicBp: t })}
              keyboardType="number-pad"
            />
            <GovtInput
              labelHi="BP diastolic"
              labelEn="BP diastolic"
              value={form.diastolicBp}
              onChangeText={(t) => patch({ diastolicBp: t })}
              keyboardType="number-pad"
            />
          </>
        ) : null}

        {stepIndex === 2 ? (
          <>
            <ToggleRow
              labelHi="पिछले वर्ष अस्पताल"
              labelEn="Hospitalized last year"
              value={form.hospitalizedLastYear}
              onChange={(v) => patch({ hospitalizedLastYear: v })}
            />
            <ToggleRow
              labelHi="नियमित दवाएं"
              labelEn="Regular medicines"
              value={form.regularMedicines}
              onChange={(v) => patch({ regularMedicines: v })}
            />
            {form.regularMedicines ? (
              <GovtInput
                labelHi="दवा का नाम"
                labelEn="Medicine name"
                value={form.medicinesName}
                onChangeText={(t) => patch({ medicinesName: t })}
              />
            ) : null}
            {patient.isPregnant ? (
              <ToggleRow
                labelHi="पहले C-section"
                labelEn="Previous C-section"
                value={form.previousCSection}
                onChange={(v) => patch({ previousCSection: v })}
              />
            ) : (
              <Text style={styles.muted}>Pregnancy history — no fetal-sex fields collected.</Text>
            )}
          </>
        ) : null}

        {stepIndex === 3 ? (
          <>
            <SymptomCard labelHi="बुखार" labelEn="Fever" value={form.fever} onChange={(v) => patch({ fever: v })} />
            <SymptomCard labelHi="खांसी" labelEn="Cough" value={form.cough} onChange={(v) => patch({ cough: v })} />
            <SymptomCard labelHi="सांस फूलना" labelEn="Breathlessness" value={form.breathless} onChange={(v) => patch({ breathless: v })} />
            <SymptomCard labelHi="छाती दर्द" labelEn="Chest pain" value={form.chestPainSym} onChange={(v) => patch({ chestPainSym: v })} />
            <SymptomCard labelHi="कमजोरी" labelEn="Weakness" value={form.weakness} onChange={(v) => patch({ weakness: v })} />
            <SymptomCard labelHi="दस्त" labelEn="Diarrhea" value={form.diarrhea} onChange={(v) => patch({ diarrhea: v })} />
            <SymptomCard labelHi="उल्टी" labelEn="Vomiting" value={form.vomiting} onChange={(v) => patch({ vomiting: v })} />
          </>
        ) : null}

        {stepIndex === 4 ? (
          <>
            <ToggleRow
              labelHi="गंभीर सांस की तकलीफ"
              labelEn="Severe breathing"
              value={form.seriousBreathing}
              onChange={(v) => patch({ seriousBreathing: v })}
            />
            <ToggleRow
              labelHi="लगातार छाती दर्द"
              labelEn="Continuous chest pain"
              value={form.seriousChestPain}
              onChange={(v) => patch({ seriousChestPain: v })}
            />
            <ToggleRow
              labelHi="चल नहीं सकते"
              labelEn="Unable to walk"
              value={form.seriousUnableWalk}
              onChange={(v) => patch({ seriousUnableWalk: v })}
            />
            <ToggleRow
              labelHi="गर्भावस्था जटिलता"
              labelEn="Pregnancy complication"
              value={form.seriousPregnancyComp}
              onChange={(v) => patch({ seriousPregnancyComp: v })}
            />
            {hasSerious ? (
              <GovtButton titleHi="आपात कॉल" titleEn="Emergency call" onPress={() => setSeriousModal(true)} variant="secondary" />
            ) : null}
          </>
        ) : null}

        {stepIndex === 5 ? (
          <>
            <Text style={styles.section}>{hiText("जीर्ण / Chronic")}</Text>
            <ToggleRow
              labelHi="बार-बार पेशाब"
              labelEn="Frequent urination"
              value={form.chronicFreqUrination}
              onChange={(v) => patch({ chronicFreqUrination: v })}
            />
            <ToggleRow
              labelHi="अधिक प्यास"
              labelEn="Excess thirst"
              value={form.chronicExcessThirst}
              onChange={(v) => patch({ chronicExcessThirst: v })}
            />
            <ToggleRow
              labelHi="जोड़ों में दर्द"
              labelEn="Joint pain"
              value={form.chronicJointPain}
              onChange={(v) => patch({ chronicJointPain: v })}
            />
            <ToggleRow
              labelHi="ज्ञात BP/DM"
              labelEn="Known BP/DM"
              value={form.chronicKnownBpDm}
              onChange={(v) => patch({ chronicKnownBpDm: v })}
            />
            <Text style={styles.section}>{hiText("संक्रामक / Communicable")}</Text>
            <ToggleRow
              labelHi="2+ सप्ताह खांसी"
              labelEn="Cough 2+ weeks"
              value={form.commCough2weeks}
              onChange={(v) => patch({ commCough2weeks: v })}
            />
            <ToggleRow
              labelHi="3+ दिन बुखार"
              labelEn="Fever 3+ days"
              value={form.commFever3days}
              onChange={(v) => patch({ commFever3days: v })}
            />
            <ToggleRow
              labelHi="संक्रमण/घाव"
              labelEn="Infection/wounds"
              value={form.commInfectionWounds}
              onChange={(v) => patch({ commInfectionWounds: v })}
            />
            <ToggleRow
              labelHi="बीमार से संपर्क"
              labelEn="Contact with sick"
              value={form.commContactSick}
              onChange={(v) => patch({ commContactSick: v })}
            />
          </>
        ) : null}

        {stepIndex === 6 ? (
          <>
            <Text style={styles.label}>
              {hiText("भेंट:")} {hiText(VISIT_TYPES.find((v) => v.key === form.visitType)?.hi || form.visitType)} / {form.visitType}
            </Text>
            <RiskBadge risk={risk} />
            <Text style={styles.factors}>
              {riskResult.triggeredFactors
                .map((item) => `${locale === "en" ? item.labelEn : hiText(item.labelHi)} (+${item.weight})`)
                .join(", ") || hiText("कोई कारक नहीं / None")}
            </Text>
            {computeSubmitSideEffects(form, riskResult, patient).followUps.length > 0 ? (
              <Text style={styles.muted}>{hiText("फॉलो-अप निर्धारित / Follow-up scheduled")}</Text>
            ) : null}
          </>
        ) : null}

        <View style={styles.nav}>
          <View style={{ flex: 1 }}>
            <GovtButton
              titleHi="पीछे"
              titleEn="Back"
              variant="secondary"
              disabled={stepIndex === 0}
              onPress={() => setStepIndex((v) => Math.max(0, v - 1))}
            />
          </View>
          <View style={{ flex: 1 }}>
            {stepIndex < STEPS.length - 1 ? (
              <GovtButton
                titleHi="आगे"
                titleEn="Next"
                onPress={() => setStepIndex((v) => Math.min(STEPS.length - 1, v + 1))}
                disabled={stepIndex === 0 && !form.consent}
              />
            ) : (
              <GovtButton titleHi="सहेजें" titleEn="Save offline" onPress={finish} loading={saving} disabled={!form.consent} />
            )}
          </View>
        </View>
      </ScrollView>

      <Modal visible={seriousModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{hiText("तत्काल सहायता / Emergency")}</Text>
            <Text style={styles.modalBody}>{hiText("गंभीर लक्षण — नजदीकी स्वास्थ्य केंद्र या आपात नंबर पर संपर्क करें।")}</Text>
            {EMERGENCY_NUMBERS.map((n) => (
              <Pressable key={n.tel} style={styles.callBtn} onPress={() => Linking.openURL(`tel:${n.tel}`)}>
                <Text style={styles.callTxt}>
                  {n.label} — {n.tel}
                </Text>
              </Pressable>
            ))}
            <GovtButton titleHi="बंद करें" titleEn="Close" onPress={() => setSeriousModal(false)} />
          </View>
        </View>
      </Modal>
      {showSuccessOverlay && (
        <View
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(255,255,255,0.95)",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
          }}
        >
          <LottieWrapper
            name="survey_success"
            size={180}
            loop={false}
            autoPlay={true}
            onFinish={() => {
              setShowSuccessOverlay(false);
              if (successParams) {
                router.replace(successParams);
              }
            }}
          />
          <Text style={{ marginTop: 12, fontWeight: "900", fontSize: 20, color: "#16A34A" }}>Survey Saved!</Text>
          <Text style={{ fontSize: 13, color: "#475569" }}>Analyzing health risks...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
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
  scrollContainer: { flex: 1 },
  scroll: { flexGrow: 1, padding: 16, paddingBottom: 48 },
  step: { fontWeight: "800", fontSize: 15, marginBottom: 12, color: COLORS.textPrimary },
  muted: { padding: 16, color: COLORS.textSecondary },
  label: { fontSize: 12, fontWeight: "700", color: COLORS.textSecondary, marginBottom: 6 },
  section: { fontSize: 14, fontWeight: "800", marginTop: 8, marginBottom: 8, color: COLORS.primary },
  row: { flexDirection: "row", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  stepRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
  stepDot: { flex: 1, height: 6, borderRadius: 3, backgroundColor: COLORS.border },
  stepDotOn: { backgroundColor: COLORS.primary },
  draftBtn: { paddingHorizontal: 8, minHeight: 52, justifyContent: "center" },
  draftTxt: { color: "#fff", fontSize: 12, fontWeight: "700" },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 52,
    justifyContent: "center",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    marginBottom: 4,
  },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipTxt: { fontSize: 12, fontWeight: "700", color: COLORS.textPrimary },
  chipTxtOn: { color: "#fff" },
  factors: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20 },
  nav: { flexDirection: "row", gap: 12, marginTop: 16 },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { backgroundColor: COLORS.card, padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: "800", color: COLORS.danger },
  modalBody: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  callBtn: { backgroundColor: COLORS.danger, padding: 14, borderRadius: 8 },
  callTxt: { color: "#fff", fontWeight: "800", textAlign: "center" },
});
