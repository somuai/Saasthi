import { calculateAgeYears } from "./mcp/dateHelpers";

/**
 * @deprecated Use `scorePatient` from `../ml/riskScorer` for ASHA survey risk.
 * This helper remains for maternal vitals scoring in legacy tests.
 */
export const RISK_MODEL_VERSION = "medilift-js-rules-v0.1";

const LEVELS = {
  low: { hi: "कम", color: "#15803D" },
  moderate: { hi: "मध्यम", color: "#B45309" },
  high: { hi: "उच्च", color: "#B91C1C" },
};

function factor(code, label, labelHi, points) {
  return { code, label, labelHi, points };
}

export function scoreMaternalRisk({ patient = {}, survey = {}, mcp = {}, now = new Date().toISOString() } = {}) {
  const triggeredFactors = [];
  const vitals = survey.vitals || {};
  const symptoms = survey.symptoms || {};
  const history = survey.history || {};
  const age = patient.dob ? calculateAgeYears(patient.dob, now) : null;
  const systolic = Number(vitals.systolicBp || mcp.systolicBp || 0);
  const diastolic = Number(vitals.diastolicBp || mcp.diastolicBp || 0);
  const hb = Number(vitals.hemoglobin || mcp.hemoglobin || 0);
  const bmi = Number(vitals.bmi || mcp.bmi || 0);

  if (age !== null && age < 18) triggeredFactors.push(factor("adolescent_pregnancy", "Age below 18 years", "18 वर्ष से कम आयु", 2));
  if (age !== null && age >= 35) triggeredFactors.push(factor("advanced_maternal_age", "Age 35 years or above", "35 वर्ष या अधिक आयु", 1));
  if (systolic >= 140 || diastolic >= 90) triggeredFactors.push(factor("high_bp", "High blood pressure", "उच्च रक्तचाप", 3));
  if (hb > 0 && hb < 8) triggeredFactors.push(factor("severe_anemia", "Severe anemia", "गंभीर एनीमिया", 3));
  else if (hb >= 8 && hb < 11) triggeredFactors.push(factor("anemia", "Anemia", "एनीमिया", 2));
  if (bmi > 0 && bmi < 18.5) triggeredFactors.push(factor("low_bmi", "Low BMI", "कम बीएमआई", 1));
  if (symptoms.feverDays >= 3) triggeredFactors.push(factor("persistent_fever", "Fever for 3 or more days", "3 दिन या अधिक बुखार", 2));
  if (symptoms.bleeding || symptoms.severeHeadache || symptoms.convulsions) {
    triggeredFactors.push(factor("danger_signs", "Reported danger sign", "खतरे का संकेत", 4));
  }
  if (history.previousCSection) triggeredFactors.push(factor("previous_c_section", "Previous C-section", "पहले सी-सेक्शन", 1));

  const score = triggeredFactors.reduce((sum, item) => sum + item.points, 0);
  const riskLevel = score >= 5 ? "high" : score >= 2 ? "moderate" : "low";

  return {
    score,
    riskLevel,
    riskLevelHi: LEVELS[riskLevel].hi,
    riskColor: LEVELS[riskLevel].color,
    triggeredFactors,
    modelVersion: RISK_MODEL_VERSION,
    computedAt: now,
  };
}
