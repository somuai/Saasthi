import { MODEL_VERSION, RISK_LEVEL_COLORS, RISK_LEVEL_HINDI } from "./riskConstants";
import {
  ancVisitCountFromMcp,
  hasModerateAnemiaFromMcp,
  hasSevereAnemiaFromMcp,
  isAncUnderUtilized,
  latestAncHb,
} from "./mcpRiskRules";

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
    hasTb: raw.has_tb ?? p.hasTb,
    hasHeartDisease: raw.has_heart_disease ?? p.hasHeartDisease,
    hospitalizedLastYear: raw.hospitalized_last_year ?? p.hospitalizedLastYear,
    lastVisited: raw.last_visited ?? p.lastVisited,
    immunizationDefaulter: raw.immunization_defaulter ?? p.immunizationDefaulter,
    latestWeightForAgeZ: raw.latest_weight_for_age_z ?? p.latestWeightForAgeZ,
  };
}

function surveyHb(s) {
  const v = s?.vitals?.hemoglobin ?? s?.hemoglobin;
  return v != null && v !== "" ? Number(v) : null;
}

function surveyBp(s) {
  const sys = Number(s?.vitals?.systolicBp ?? s?.systolicBp ?? 0);
  const dia = Number(s?.vitals?.diastolicBp ?? s?.diastolicBp ?? 0);
  return { sys, dia };
}

export const RISK_RULES = [
  {
    factor: "severe_breathing",
    labelHi: "गंभीर सांस लेने में कठिनाई",
    labelEn: "Severe Breathing Difficulty",
    category: "critical",
    weight: 35,
    check: (p, s) =>
      s?.seriousConditions?.severBreathing === true ||
      s?.seriousConditions?.severeBreathing === true ||
      s?.serious_severe_breathing === true,
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
    factor: "unable_to_walk",
    labelHi: "चलने में असमर्थ",
    labelEn: "Unable to Walk",
    category: "critical",
    weight: 30,
    check: (p, s) => s?.seriousConditions?.unableToWalk === true || s?.serious_unable_walk === true,
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
    factor: "severe_anemia",
    labelHi: "गंभीर एनीमिया (Hb < 8)",
    labelEn: "Severe Anemia",
    category: "critical",
    weight: 28,
    check: (p, s, mcp) => {
      const hb = surveyHb(s) ?? latestAncHb(mcp);
      return (hb != null && hb > 0 && hb < 8) || hasSevereAnemiaFromMcp(mcp);
    },
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
    factor: "anc_under_utilized",
    labelHi: "ANC कम उपयोग",
    labelEn: "Under-utilized ANC",
    category: "maternal",
    weight: 18,
    check: (p, s, mcp) => p.isPregnant && isAncUnderUtilized(mcp),
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
    factor: "high_bp",
    labelHi: "उच्च रक्तचाप",
    labelEn: "High Blood Pressure",
    category: "chronic",
    weight: 20,
    check: (p, s, mcp) => {
      const { sys, dia } = surveyBp(s);
      if (sys >= 140 || dia >= 90) return true;
      const ms = Number(mcp?.bpSystolic ?? mcp?.latestAncVisit?.bpSystolic ?? 0);
      const md = Number(mcp?.bpDiastolic ?? mcp?.latestAncVisit?.bpDiastolic ?? 0);
      return ms >= 140 || md >= 90 || p.hasHypertension === true;
    },
  },
  {
    factor: "diabetes",
    labelHi: "मधुमेह",
    labelEn: "Diabetes",
    category: "chronic",
    weight: 18,
    check: (p, s) => p.hasDiabetes === true || s?.chronic_known_bp_dm === true || s?.chronicKnownBpDm === true,
  },
  {
    factor: "anemia",
    labelHi: "एनीमिया (Hb < 11)",
    labelEn: "Anemia",
    category: "chronic",
    weight: 16,
    check: (p, s, mcp) => {
      const hb = surveyHb(s) ?? latestAncHb(mcp);
      return (hb != null && hb >= 8 && hb < 11) || hasModerateAnemiaFromMcp(mcp);
    },
  },
  {
    factor: "hypertension",
    labelHi: "उच्च रक्तचाप (ज्ञात)",
    labelEn: "Known Hypertension",
    category: "chronic",
    weight: 16,
    check: (p) => p.hasHypertension === true,
  },
  {
    factor: "chronic_bp_dm_symptoms",
    labelHi: "मधुमेह/बीपी लक्षण",
    labelEn: "Diabetes/BP Symptoms",
    category: "chronic",
    weight: 12,
    check: (p, s) =>
      s?.chronic_freq_urination === true ||
      s?.chronic_excess_thirst === true ||
      s?.chronicKnownBpDm === true,
  },
  {
    factor: "has_tb",
    labelHi: "टीबी इतिहास",
    labelEn: "TB History",
    category: "chronic",
    weight: 14,
    check: (p) => p.hasTb === true,
  },
  {
    factor: "heart_disease",
    labelHi: "हृदय रोग",
    labelEn: "Heart Disease",
    category: "chronic",
    weight: 14,
    check: (p) => p.hasHeartDisease === true,
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
    factor: "infection_wounds",
    labelHi: "संक्रमण/घाव",
    labelEn: "Infection or Wounds",
    category: "communicable",
    weight: 10,
    check: (p, s) => s?.communicable?.infectionWounds === true || s?.comm_infection_wounds === true,
  },
  {
    factor: "contact_sick",
    labelHi: "बीमार व्यक्ति से संपर्क",
    labelEn: "Contact with Sick Person",
    category: "communicable",
    weight: 8,
    check: (p, s) => s?.communicable?.contactSick === true || s?.comm_contact_sick === true,
  },
  {
    factor: "immunization_defaulter",
    labelHi: "टीकाकरण चूका",
    labelEn: "Immunization Defaulter",
    category: "child",
    weight: 14,
    check: (p) => p.immunizationDefaulter === true,
  },
  {
    factor: "malnutrition",
    labelHi: "कुपोषण (WFA Z)",
    labelEn: "Malnutrition",
    category: "child",
    weight: 16,
    check: (p) => (p.latestWeightForAgeZ ?? 0) < -2,
  },
  {
    factor: "hospitalized_last_year",
    labelHi: "पिछले वर्ष अस्पताल में भर्ती",
    labelEn: "Hospitalized Last Year",
    category: "history",
    weight: 8,
    check: (p) => p.hospitalizedLastYear === true,
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
  const primaryCategory = getPrimaryCategory(triggeredFactors);
  const recommendation = getRecommendation(riskLevel, primaryCategory);
  return {
    score,
    riskLevel,
    riskLevelHi: RISK_LEVEL_HINDI[riskLevel],
    riskColor: RISK_LEVEL_COLORS[riskLevel],
    triggeredFactors,
    triggeredByCategory: groupByCategory(triggeredFactors),
    primaryCategory,
    recommendation,
    recommendationSource: "rule_template",
    modelVersion: MODEL_VERSION,
    computedAt: new Date().toISOString(),
    totalFactorsChecked: RISK_RULES.length,
    factorsTriggered: triggeredFactors.length,
    skippedFactors,
  };
}

/**
 * Mirror of backend RECOMMENDATION_TEMPLATES from risk_engine/engine.py.
 * Maps (riskLevel, primaryCategory) to bilingual recommendation text + urgency.
 */
export const RECOMMENDATIONS = {
  high_communicable: {
    en: "Refer to PHC within 24 hours. Possible infectious disease.",
    hi: "24 घंटे के अंदर PHC में भेजें। संभावित संक्रामक रोग।",
    urgency: "within_24h",
  },
  high_chronic: {
    en: "Refer to PHC within 24 hours. Chronic condition needs clinical review.",
    hi: "24 घंटे के अंदर PHC में भेजें। दीर्घकालिक स्थिति की जांच ज़रूरी।",
    urgency: "within_24h",
  },
  high_critical: {
    en: "EMERGENCY — refer to hospital immediately. Do not delay.",
    hi: "आपातकाल — तुरंत अस्पताल भेजें। देरी न करें।",
    urgency: "immediate",
  },
  high_maternal: {
    en: "Refer to PHC/CHC immediately. High-risk pregnancy.",
    hi: "PHC/CHC में तुरंत भेजें। उच्च जोखिम गर्भावस्था।",
    urgency: "immediate",
  },
  medium_general: {
    en: "Schedule PHC visit within 3 days. Monitor symptoms daily.",
    hi: "3 दिनों में PHC विजिट शेड्यूल करें। रोज़ लक्षण देखें।",
    urgency: "within_3_days",
  },
  low_general: {
    en: "Continue monitoring. Follow up in 2 weeks.",
    hi: "निगरानी जारी रखें। 2 हफ्ते में फिर मिलें।",
    urgency: "routine",
  },
};

/** Derive primary category from triggered factors (mirrors backend derive_categories). */
export function getPrimaryCategory(factors) {
  if (!factors || factors.length === 0) return "general";
  const weights = {};
  for (const f of factors) {
    const cat = f.category || "general";
    weights[cat] = (weights[cat] || 0) + (f.weight || 1);
  }
  const sorted = Object.entries(weights).sort((a, b) => b[1] - a[1]);
  return sorted[0][0];
}

/**
 * Mirror of backend RiskEngine.get_recommendation().
 * Returns { en, hi, urgency } matching the risk level + primary category.
 */
export function getRecommendation(riskLevel, primaryCategory) {
  const key = `${riskLevel}_${primaryCategory}`;
  const fallback = `${riskLevel}_general`;
  return RECOMMENDATIONS[key] || RECOMMENDATIONS[fallback] || RECOMMENDATIONS.low_general;
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
