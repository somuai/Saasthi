import { scorePatient } from "../src/ml/riskScorer";
import { ensureModelLoaded, scoreWithBestAvailable } from "../src/ml/riskEngine";

describe("scorePatient", () => {
  it("returns bounded score and level", () => {
    const r = scorePatient(
      { age: 70, isPregnant: true, hasDiabetes: true },
      { communicable: { feverOver3Days: true, coughOver2Weeks: true }, livingCondition: "poor" },
      { isHighRisk: true },
    );
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(["low", "medium", "high", "critical"]).toContain(r.riskLevel);
    expect(r.triggeredFactors.length).toBeGreaterThan(0);
    expect(r.totalFactorsChecked).toBeGreaterThanOrEqual(25);
  });
});

describe("TFLite scoreWithBestAvailable", () => {
  it("computes non-zero score when model is loaded", async () => {
    await ensureModelLoaded();
    const r = await scoreWithBestAvailable(
      { age: 70, isPregnant: true, hasDiabetes: true },
      { communicable: { feverOver3Days: true, coughOver2Weeks: true }, livingCondition: "poor" },
      { isHighRisk: true },
    );
    expect(r.score).toBeGreaterThan(0);
    expect(r.modelSource).toBe("tflite");
    expect(r.recommendation).toEqual(expect.objectContaining({ en: expect.any(String), hi: expect.any(String) }));
    expect(r.triggeredFactors.length).toBeGreaterThan(0);
    expect(r.modelVersion).toBe("1.0.0-rule-export");
  });
});
