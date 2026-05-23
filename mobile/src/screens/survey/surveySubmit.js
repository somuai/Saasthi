/** Pure survey helpers — shared by SurveyScreen and Jest evals. */

export const VISIT_TYPES = [
  { key: "first", hi: "पहली बार", en: "First visit" },
  { key: "followup", hi: "फॉलो-अप", en: "Follow-up" },
  { key: "emergency", hi: "आपात", en: "Emergency" },
];

export function emptySurveyForm() {
  const EMPTY_SYMPTOM = { present: false, severity: null, days: null };
  return {
    consent: true,
    visitType: "first",
    ashaObservation: "",
    livingCondition: "moderate",
    healthcareAccess: "easy",
    hospitalizedLastYear: false,
    regularMedicines: false,
    medicinesName: "",
    previousCSection: false,
    heightCm: "",
    weightKg: "",
    hemoglobin: "",
    systolicBp: "",
    diastolicBp: "",
    fever: { ...EMPTY_SYMPTOM },
    cough: { ...EMPTY_SYMPTOM },
    breathless: { ...EMPTY_SYMPTOM },
    chestPainSym: { ...EMPTY_SYMPTOM },
    weakness: { ...EMPTY_SYMPTOM },
    diarrhea: { ...EMPTY_SYMPTOM },
    vomiting: { ...EMPTY_SYMPTOM },
    seriousBreathing: false,
    seriousChestPain: false,
    seriousUnableWalk: false,
    seriousPregnancyComp: false,
    chronicFreqUrination: false,
    chronicExcessThirst: false,
    chronicJointPain: false,
    chronicKnownBpDm: false,
    commCough2weeks: false,
    commFever3days: false,
    commInfectionWounds: false,
    commContactSick: false,
  };
}

export function prefillHistoryFromPatient(form, patient) {
  if (!patient) return form;
  return {
    ...form,
    hospitalizedLastYear: patient.hospitalizedLastYear ?? form.hospitalizedLastYear,
    regularMedicines: patient.regularMedicines ?? form.regularMedicines,
    medicinesName: patient.medicinesName || form.medicinesName,
    chronicKnownBpDm: patient.hasDiabetes || patient.hasHypertension || form.chronicKnownBpDm,
    previousCSection: form.previousCSection,
  };
}

export function symptomJson(sym) {
  if (!sym?.present) return null;
  return JSON.stringify({
    present: true,
    severity: sym.severity || "mild",
    days: sym.days ?? null,
  });
}

/** Server flagging + risk scorer payload (snake_case keys included). */
export function buildSurveyPayload(form) {
  const feverDays = form.fever?.present ? Number(form.fever.days || 0) : 0;
  const coughWeeks = form.cough?.present ? Number(form.cough.days || 0) >= 14 : false;
  return {
    visit_type: form.visitType,
    ashaObservation: form.ashaObservation,
    livingCondition: form.livingCondition,
    healthcareAccess: form.healthcareAccess,
    vitals: {
      heightCm: form.heightCm,
      weightKg: form.weightKg,
      hemoglobin: form.hemoglobin,
      systolicBp: form.systolicBp,
      diastolicBp: form.diastolicBp,
    },
    history: { previousCSection: form.previousCSection },
    communicable: {
      feverOver3Days: form.commFever3days || feverDays >= 3,
      coughOver2Weeks: form.commCough2weeks || coughWeeks,
      infectionWounds: form.commInfectionWounds,
      contactSick: form.commContactSick,
    },
    seriousConditions: {
      severeBreathing: form.seriousBreathing,
      chestPain: form.seriousChestPain,
      unableToWalk: form.seriousUnableWalk,
      pregnancyComplications: form.seriousPregnancyComp,
    },
    serious_severe_breathing: form.seriousBreathing,
    serious_chest_pain: form.seriousChestPain,
    serious_unable_walk: form.seriousUnableWalk,
    serious_pregnancy_comp: form.seriousPregnancyComp,
    chronic_freq_urination: form.chronicFreqUrination,
    chronic_excess_thirst: form.chronicExcessThirst,
    chronic_joint_pain: form.chronicJointPain,
    chronic_known_bp_dm: form.chronicKnownBpDm,
    comm_cough_2weeks: form.commCough2weeks || coughWeeks,
    comm_fever_3days: form.commFever3days || feverDays >= 3,
    comm_infection_wounds: form.commInfectionWounds,
    comm_contact_sick: form.commContactSick,
  };
}

/** TB screening heuristic per ASHA cluster guidance. */
export function detectTbRisk(form) {
  const payload = buildSurveyPayload(form);
  const cough = payload.comm_cough_2weeks;
  const fever = payload.comm_fever_3days || form.fever?.present;
  const weightLoss = form.weakness?.present && (form.weakness.severity === "severe" || (form.weakness.days || 0) >= 14);
  return cough && (fever || weightLoss);
}

export function computeSubmitSideEffects(form, riskResult, patient) {
  const hasSerious = form.seriousBreathing || form.seriousChestPain || form.seriousUnableWalk || form.seriousPregnancyComp;
  const tbRisk = detectTbRisk(form);
  const flags = [];
  const followUps = [];

  if (hasSerious) {
    flags.push({ flagType: "danger_sign", severity: "critical", description: "Danger signs reported" });
  } else if (riskResult.riskLevel === "high" || riskResult.riskLevel === "critical") {
    flags.push({
      flagType: "high_risk_survey",
      severity: riskResult.riskLevel === "critical" ? "critical" : "high",
      description: "Survey risk elevation",
    });
  }
  if (tbRisk) {
    flags.push({ flagType: "TB_RISK", severity: "high", description: "TB cluster — cough + fever/weight loss" });
    followUps.push({ followType: "tb_screening", daysOffset: 7 });
  }
  if (riskResult.riskLevel !== "low" && !followUps.length) {
    followUps.push({
      followType: riskResult.riskLevel === "critical" ? "emergency" : "routine",
      daysOffset: riskResult.riskLevel === "critical" ? 3 : 7,
    });
  }
  return { flags, followUps, hasSerious, tbRisk };
}
