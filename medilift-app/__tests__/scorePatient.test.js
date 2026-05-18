import { scorePatient } from "../src/ml/riskScorer";

describe("scorePatient", () => {
  it("returns bounded score and level", () => {
    const r = scorePatient(
      { age: 70, isPregnant: true, hasDiabetes: true },
      { communicable: { feverOver3Days: true, coughOver2Weeks: true }, livingCondition: "poor" },
      { isHighRisk: true }
    );
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(["low", "medium", "high", "critical"]).toContain(r.riskLevel);
    expect(r.triggeredFactors.length).toBeGreaterThan(0);
  });
});
