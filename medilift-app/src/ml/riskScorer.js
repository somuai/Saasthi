import { MODEL_VERSION, RISK_LEVEL_COLORS, RISK_LEVEL_HINDI } from "./riskConstants";

function getRiskLevel(score) {
  if (score <= 25) return "low";
  if (score <= 50) return "medium";
  if (score <= 75) return "high";
  return "critical";
}

function groupByCategory(factors) {
  return factors.reduce((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(f);
    return acc;
  }, {});
}

/** Normalize patient from Watermelon model or plain object */
function normPatient(p) {
  if (!p) return {};
  const raw = p._raw || p;
  return {
    age: raw.age ?? p.age,
    isPregnant: raw.is_pregnant ?? p.isPregnant,
    hasDiabetes: raw.has_diabetes ?? p.hasDiabetes,
    hasHypertension: raw.has_hypertension ?? p.hasHypertension,
    hospitalizedLastYear: raw.hospitalized_last_year ?? p.hospitalizedLastYear,
    lastVisited: raw.last_visited ?? p.lastVisited,
    immunizationDefaulter: raw.immunization_defaulter ?? p.immunizationDefaulter,
    latestWeightForAgeZ: raw.latest_weight_for_age_z ?? p.latestWeightForAgeZ,
  };
}

export const RISK_RULES = [
  {
    factor: "severe_breathing",
    labelHi: "गंभीर सांस लेने में कठिनाई",
    labelEn: "Severe Breathing Difficulty",
    category: "critical",
    weight: 35,
    check: (p, s) =>
      s?.seriousConditions?.severBreathing === true || s?.seriousConditions?.severeBreathing === true || s?.serious_severe_breathing === true,
  },
  {
    factor: "continuous_chest_pain",
    labelHi: "लगातार छाती दर्द",
    labelEn: "Continuous Chest Pain",
    category: "critical",
    weight: 32,
    check: (p, s) => s?.seriousConditions?.chestPain === true || s?.serious_chest_pain === true,
  },
  {
    factor: "pregnancy_complications",
    labelHi: "गर्भावस्था जटिलताएं",
    labelEn: "Pregnancy Complications",
    category: "critical",
    weight: 30,
    check: (p, s) => s?.seriousConditions?.pregnancyComplications === true || s?.serious_pregnancy_comp === true,
  },
  {
    factor: "pregnant",
    labelHi: "गर्भवती",
    labelEn: "Pregnant",
    category: "maternal",
    weight: 22,
    check: (p) => p.isPregnant === true,
  },
  {
    factor: "high_risk_pregnancy",
    labelHi: "उच्च जोखिम गर्भावस्था",
    labelEn: "High Risk Pregnancy",
    category: "maternal",
    weight: 25,
    check: (p, s, mcp) => mcp?.is_high_risk === true || mcp?.isHighRisk === true,
  },
  {
    factor: "tb_cough",
    labelHi: "2 सप्ताह से अधिक खांसी (TB जोखिम)",
    labelEn: "Cough > 2 weeks (TB Risk)",
    category: "communicable",
    weight: 22,
    check: (p, s) => s?.communicable?.coughOver2Weeks === true || s?.comm_cough_2weeks === true,
  },
  {
    factor: "diabetes",
    labelHi: "मधुमेह",
    labelEn: "Diabetes",
    category: "chronic",
    weight: 18,
    check: (p, s) => p.hasDiabetes === true || s?.hasDiabetes === true,
  },
  {
    factor: "hypertension",
    labelHi: "उच्च रक्तचाप",
    labelEn: "High Blood Pressure",
    category: "chronic",
    weight: 16,
    check: (p) => p.hasHypertension === true,
  },
  {
    factor: "age_elderly",
    labelHi: "वृद्ध (60+ वर्ष)",
    labelEn: "Elderly (60+ years)",
    category: "demographic",
    weight: 15,
    check: (p) => (p.age ?? 0) >= 60,
  },
  {
    factor: "age_infant",
    labelHi: "शिशु (0-5 वर्ष)",
    labelEn: "Infant (0-5 years)",
    category: "demographic",
    weight: 12,
    check: (p) => (p.age ?? 99) <= 5,
  },
  {
    factor: "fever_3days",
    labelHi: "3 दिन से अधिक बुखार",
    labelEn: "Fever > 3 days",
    category: "communicable",
    weight: 10,
    check: (p, s) => s?.communicable?.feverOver3Days === true || s?.comm_fever_3days === true,
  },
  {
    factor: "no_healthcare_access",
    labelHi: "स्वास्थ्य सेवा पहुंच मुश्किल",
    labelEn: "Difficult Healthcare Access",
    category: "social",
    weight: 10,
    check: (p, s) => s?.healthcareAccess === "difficult" || s?.healthcare_access === "difficult",
  },
  {
    factor: "poor_living_condition",
    labelHi: "खराब रहन-सहन",
    labelEn: "Poor Living Conditions",
    category: "social",
    weight: 8,
    check: (p, s) => s?.livingCondition === "poor" || s?.living_condition === "poor",
  },
];

export function scorePatient(patient, survey = null, mcpData = null) {
  const p = normPatient(patient);
  let totalScore = 0;
  const triggeredFactors = [];
  const skippedFactors = [];
  for (const rule of RISK_RULES) {
    try {
      if (rule.check(p, survey, mcpData)) {
        totalScore += rule.weight;
        triggeredFactors.push({
          factor: rule.factor,
          labelHi: rule.labelHi,
          labelEn: rule.labelEn,
          category: rule.category,
          weight: rule.weight,
        });
      }
    } catch {
      skippedFactors.push(rule.factor);
    }
  }
  const score = Math.min(Math.round(totalScore), 100);
  const riskLevel = getRiskLevel(score);
  return {
    score,
    riskLevel,
    riskLevelHi: RISK_LEVEL_HINDI[riskLevel],
    riskColor: RISK_LEVEL_COLORS[riskLevel],
    triggeredFactors,
    triggeredByCategory: groupByCategory(triggeredFactors),
    modelVersion: MODEL_VERSION,
    computedAt: new Date().toISOString(),
    totalFactorsChecked: RISK_RULES.length,
    factorsTriggered: triggeredFactors.length,
    skippedFactors,
  };
}

export async function rescoreAllPatients(db) {
  const { Q } = await import("@nozbe/watermelondb");
  const patients = await db.collections.get("patients").query(Q.where("is_deleted", false)).fetch();
  await db.write(async () => {
    for (const patient of patients) {
      const result = scorePatient(patient);
      await patient.update((rec) => {
        rec.riskScore = result.score;
        rec.riskLevel = result.riskLevel;
        rec.isSynced = false;
        rec.updatedAt = Date.now();
      });
    }
  });
  return patients.length;
}
