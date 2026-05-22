import { FEATURES } from "../constants/featureFlags";
import { scorePatient, rescoreAllPatients } from "./riskScorer";
import { loadRiskModel, isModelReady, runRiskInference } from "./TFLiteService";

let modelInitAttempted = false;

export async function ensureModelLoaded() {
  if (modelInitAttempted) return;
  modelInitAttempted = true;
  if (FEATURES.TFLITE_SCORING) {
    await loadRiskModel();
  }
}

export async function scoreWithBestAvailable(patient, survey, mcpData) {
  if (FEATURES.TFLITE_SCORING && isModelReady()) {
    const result = await runRiskInference(patient, survey, mcpData);
    if (result) {
      return {
        ...result,
        riskLevel: riskLevelFromScore(result.score),
        modelSource: "tflite",
      };
    }
  }
  const ruleResult = scorePatient(patient, survey, mcpData);
  return { ...ruleResult, modelSource: "rule_template" };
}

function riskLevelFromScore(score) {
  if (score <= 25) return "low";
  if (score <= 50) return "medium";
  if (score <= 75) return "high";
  return "critical";
}

export { scorePatient, rescoreAllPatients };
