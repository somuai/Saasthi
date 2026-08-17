import { FEATURES } from "../constants/featureFlags";
import { RISK_LEVEL_COLORS, RISK_LEVEL_HINDI } from "./riskConstants";
import { scorePatient, rescoreAllPatients, getRecommendation } from "./riskScorer";
import { loadRiskModel, isModelReady, runRiskInference, getModelVersion } from "./TFLiteService";

let modelInitAttempted = false;

export async function ensureModelLoaded() {
  if (modelInitAttempted) return;
  modelInitAttempted = true;
  if (FEATURES.TFLITE_SCORING) {
    await loadRiskModel();
  }
}

export async function scoreWithBestAvailable(patient, survey, mcpData) {
  const ruleResult = scorePatient(patient, survey, mcpData);
  if (FEATURES.TFLITE_SCORING && isModelReady()) {
    const result = await runRiskInference(patient, survey, mcpData);
    if (result) {
      const riskLevel = riskLevelFromScore(result.score);
      return {
        ...ruleResult,
        ...result,
        riskLevel,
        riskLevelHi: RISK_LEVEL_HINDI[riskLevel],
        riskColor: RISK_LEVEL_COLORS[riskLevel],
        recommendation: getRecommendation(riskLevel, ruleResult.primaryCategory),
        modelSource: "tflite",
        recommendationSource: "tflite",
        modelVersion: getModelVersion(),
      };
    }
  }
  return { ...ruleResult, modelSource: "rule_template" };
}

function riskLevelFromScore(score) {
  if (score <= 25) return "low";
  if (score <= 50) return "medium";
  if (score <= 75) return "high";
  return "critical";
}

export { scorePatient, rescoreAllPatients };
