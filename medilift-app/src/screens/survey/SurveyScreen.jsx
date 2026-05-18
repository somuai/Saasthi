import { useMemo, useState, useEffect } from "react";
import { Switch, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDatabase } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import { useDispatch } from "react-redux";
import { Button } from "../../components/Button";
import { RiskBadge } from "../../components/RiskBadge";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { colors, typography } from "../../constants/design";
import { scorePatient } from "../../ml/riskScorer";
import { todayYmd } from "../../utils/dateHelpers";
import { incrementPendingCount } from "../../features/sync/syncSlice";

const steps = [
  "Consent / सहमति",
  "Household / परिवार",
  "Vitals / जांच",
  "Pregnancy / गर्भावस्था",
  "Symptoms / लक्षण",
  "Review / समीक्षा",
];

export default function SurveyScreen() {
  const { patientId } = useLocalSearchParams();
  const database = useDatabase();
  const [patient, setPatient] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [consent, setConsent] = useState(true);
  const [heightCm, setHeightCm] = useState("155");
  const [weightKg, setWeightKg] = useState("48");
  const [hemoglobin, setHemoglobin] = useState("10.5");
  const [systolicBp, setSystolicBp] = useState("118");
  const [diastolicBp, setDiastolicBp] = useState("76");
  const [feverDays, setFeverDays] = useState("0");
  const [bleeding, setBleeding] = useState(false);
  const [severeHeadache, setSevereHeadache] = useState(false);
  const [notes, setNotes] = useState("");
  const dispatch = useDispatch();
  const router = useRouter();

  useEffect(() => {
    if (!patientId) return undefined;
    const q = database.collections.get("patients").query(Q.where("id", patientId));
    const sub = q.observe().subscribe((r) => setPatient(r[0] || null));
    return () => sub.unsubscribe();
  }, [database, patientId]);

  const surveyForScore = useMemo(
    () => ({
      communicable: {
        feverOver3Days: Number(feverDays) >= 3,
        coughOver2Weeks: false,
      },
      seriousConditions: {
        pregnancyComplications: bleeding || severeHeadache,
        severBreathing: false,
        chestPain: false,
        unableToWalk: false,
      },
      livingCondition: "moderate",
      healthcareAccess: "easy",
    }),
    [bleeding, feverDays, severeHeadache]
  );

  const pNorm = patient
    ? {
        age: patient.age,
        isPregnant: patient.isPregnant,
        hasDiabetes: patient.hasDiabetes,
        hasHypertension: patient.hasHypertension,
        hospitalizedLastYear: patient.hospitalizedLastYear,
        lastVisited: patient.lastVisited,
      }
    : {};

  const riskResult = scorePatient(pNorm, surveyForScore, null);
  const risk = {
    riskLevel: riskResult.riskLevel,
    score: riskResult.score,
    riskLevelHi: riskResult.riskLevelHi,
    riskColor: riskResult.riskColor,
  };

  async function finish() {
    if (!patient) return;
    const r = scorePatient(pNorm, surveyForScore, null);
    const now = Date.now();
    const day = todayYmd();
    await database.write(async () => {
      const survey = await database.collections.get("survey_responses").create((s) => {
        s.patientId = patient.id;
        s.surveyDate = day;
        s.visitType = "first";
        s.consentAccepted = consent;
        s.consentVersion = "pilot-v1";
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
        p.isSynced = false;
        p.updatedAt = now;
      });
      if (r.riskLevel !== "low") {
        const due = new Date();
        due.setDate(due.getDate() + 7);
        await database.collections.get("follow_ups").create((f) => {
          f.patientId = patient.id;
          f.surveyId = survey.id;
          f.dueDate = due.toISOString().slice(0, 10);
          f.isCompleted = false;
          f.followType = r.riskLevel === "critical" ? "emergency" : "routine";
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
    dispatch(incrementPendingCount(4));
    router.replace(`/(tabs)/patients/${patient.id}`);
  }

  if (!patient) {
    return (
      <Screen>
        <Text style={typography.title}>Patient not found</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <Text style={typography.title}>Survey / सर्वे</Text>
        <Text style={typography.body}>
          {patient.name} - Step {stepIndex + 1} of 6: {steps[stepIndex]}
        </Text>
      </View>

      {stepIndex === 0 ? (
        <View style={{ alignItems: "center", flexDirection: "row", gap: 12, minHeight: 52 }}>
          <Switch value={consent} onValueChange={setConsent} trackColor={{ true: colors.primary }} />
          <Text style={typography.body}>Care consent confirmed / देखभाल सहमति पुष्टि</Text>
        </View>
      ) : null}

      {stepIndex === 1 ? (
        <TextField label="Household notes / परिवार नोट्स" value={notes} onChangeText={setNotes} multiline />
      ) : null}

      {stepIndex === 2 ? (
        <>
          <TextField label="Height cm / ऊंचाई" value={heightCm} onChangeText={setHeightCm} keyboardType="numeric" />
          <TextField label="Weight kg / वजन" value={weightKg} onChangeText={setWeightKg} keyboardType="numeric" />
          <TextField label="Hemoglobin / हीमोग्लोबिन" value={hemoglobin} onChangeText={setHemoglobin} keyboardType="numeric" />
          <TextField label="BP systolic / बीपी सिस्टोलिक" value={systolicBp} onChangeText={setSystolicBp} keyboardType="numeric" />
          <TextField label="BP diastolic / बीपी डायस्टोलिक" value={diastolicBp} onChangeText={setDiastolicBp} keyboardType="numeric" />
        </>
      ) : null}

      {stepIndex === 3 ? (
        <Text style={typography.body}>Pregnancy history only; no fetal-sex fields are collected.</Text>
      ) : null}

      {stepIndex === 4 ? (
        <>
          <TextField label="Fever days / बुखार के दिन" value={feverDays} onChangeText={setFeverDays} keyboardType="numeric" />
          <View style={{ alignItems: "center", flexDirection: "row", gap: 12, minHeight: 52 }}>
            <Switch value={bleeding} onValueChange={setBleeding} trackColor={{ true: colors.danger }} />
            <Text style={typography.body}>Bleeding / रक्तस्राव</Text>
          </View>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 12, minHeight: 52 }}>
            <Switch value={severeHeadache} onValueChange={setSevereHeadache} trackColor={{ true: colors.danger }} />
            <Text style={typography.body}>Severe headache / तेज सिरदर्द</Text>
          </View>
        </>
      ) : null}

      {stepIndex === 5 ? (
        <>
          <RiskBadge risk={risk} />
          <Text style={typography.body}>
            Factors:{" "}
            {riskResult.triggeredFactors.map((item) => `${item.labelHi} (+${item.weight})`).join(", ") || "None"}
          </Text>
        </>
      ) : null}

      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Button label="Back / पीछे" variant="secondary" disabled={stepIndex === 0} onPress={() => setStepIndex((value) => Math.max(0, value - 1))} />
        </View>
        <View style={{ flex: 1 }}>
          {stepIndex < 5 ? (
            <Button label="Next / आगे" onPress={() => setStepIndex((value) => Math.min(5, value + 1))} />
          ) : (
            <Button label="Save offline / ऑफलाइन सेव करें" onPress={finish} disabled={!consent} />
          )}
        </View>
      </View>
    </Screen>
  );
}
