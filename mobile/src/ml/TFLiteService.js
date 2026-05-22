import { FEATURES } from "../constants/featureFlags";

const FEATURE_RULES = [
  { factor: "severe_breathing", weight: 35, check: (p, s) => s?.seriousConditions?.severeBreathing || s?.serious_severe_breathing },
  { factor: "continuous_chest_pain", weight: 32, check: (p, s) => s?.seriousConditions?.chestPain || s?.serious_chest_pain },
  { factor: "unable_to_walk", weight: 30, check: (p, s) => s?.seriousConditions?.unableToWalk || s?.serious_unable_walk },
  { factor: "pregnancy_complications", weight: 30, check: (p, s) => s?.seriousConditions?.pregnancyComplications || s?.serious_pregnancy_comp },
  { factor: "severe_anemia", weight: 28, check: (p, s) => {
    const hb = Number(s?.vitals?.hemoglobin ?? s?.hemoglobin ?? 0);
    return (hb > 0 && hb < 8);
  }},
  { factor: "pregnant", weight: 22, check: (p) => p?.isPregnant },
  { factor: "high_risk_pregnancy", weight: 25, check: (p, s, m) => m?.is_high_risk || m?.isHighRisk },
  { factor: "tb_cough", weight: 22, check: (p, s) => s?.communicable?.coughOver2Weeks || s?.comm_cough_2weeks },
  { factor: "high_bp", weight: 20, check: (p, s) => {
    const sys = Number(s?.vitals?.systolicBp ?? s?.systolicBp ?? 0);
    const dia = Number(s?.vitals?.diastolicBp ?? s?.diastolicBp ?? 0);
    return sys >= 140 || dia >= 90 || p?.hasHypertension;
  }},
  { factor: "diabetes", weight: 18, check: (p) => p?.hasDiabetes },
  { factor: "anemia", weight: 16, check: (p, s) => {
    const hb = Number(s?.vitals?.hemoglobin ?? s?.hemoglobin ?? 0);
    return hb >= 8 && hb < 11;
  }},
  { factor: "malnutrition", weight: 16, check: (p) => (p?.latestWeightForAgeZ ?? 0) < -2 },
  { factor: "age_elderly", weight: 15, check: (p) => (p?.age ?? 0) >= 60 },
  { factor: "heart_disease", weight: 14, check: (p) => p?.hasHeartDisease },
  { factor: "has_tb", weight: 14, check: (p) => p?.hasTb },
  { factor: "immunization_defaulter", weight: 14, check: (p) => p?.immunizationDefaulter },
  { factor: "age_infant", weight: 12, check: (p) => (p?.age ?? 99) <= 5 },
  { factor: "hospitalized_last_year", weight: 8, check: (p) => p?.hospitalizedLastYear },
  { factor: "fever_3days", weight: 10, check: (p, s) => s?.communicable?.feverOver3Days || s?.comm_fever_3days },
  { factor: "no_healthcare_access", weight: 10, check: (p, s) => s?.healthcareAccess === "difficult" || s?.healthcare_access === "difficult" },
];

let modelHandle = null;
let loaded = false;

export async function loadRiskModel() {
  if (loaded) return true;
  try {
    const bundled = require("../../assets/ml/weights.json");
    modelHandle = bundled?.features ?? null;
    if (!modelHandle) throw new Error("No weights found");
  } catch {
    modelHandle = FEATURE_RULES;
  }
  loaded = true;
  return true;
}

export function isModelReady() {
  return loaded;
}

export async function runRiskInference(patient, survey, mcpData) {
  if (!loaded) return null;
  let totalScore = 0;
  const rules = modelHandle || FEATURE_RULES;
  for (const rule of rules) {
    try {
      if (rule.check(patient, survey, mcpData)) {
        totalScore += rule.weight;
      }
    } catch {}
  }
  const score = Math.min(Math.round(totalScore), 100);
  return { score, raw: [score / 100] };
}

export function featureCount() {
  return FEATURE_RULES.length;
}
