import { scoreMaternalRisk } from "../src/utils/riskScorer";

describe("scoreMaternalRisk", () => {
  it("returns the public risk output contract", () => {
    const result = scoreMaternalRisk({
      patient: { dob: "2007-08-30" },
      survey: {
        vitals: { hemoglobin: 7.8, systolicBp: 146, diastolicBp: 92, bmi: 17.9 },
        symptoms: { feverDays: 3, bleeding: true },
      },
      now: "2026-05-18T00:00:00.000Z",
    });

    expect(result).toEqual(
      expect.objectContaining({
        score: expect.any(Number),
        riskLevel: "high",
        riskLevelHi: "उच्च",
        riskColor: "#B91C1C",
        triggeredFactors: expect.any(Array),
        modelVersion: "medilift-js-rules-v0.1",
        computedAt: "2026-05-18T00:00:00.000Z",
      })
    );
    expect(result.triggeredFactors.map((item) => item.code)).toEqual(
      expect.arrayContaining(["severe_anemia", "high_bp", "danger_signs"])
    );
  });

  it("keeps low-risk records low when no rule triggers", () => {
    const result = scoreMaternalRisk({
      patient: { dob: "1998-04-12" },
      survey: {
        vitals: { hemoglobin: 12.1, systolicBp: 110, diastolicBp: 72, bmi: 21.2 },
        symptoms: { feverDays: 0 },
      },
      now: "2026-05-18T00:00:00.000Z",
    });

    expect(result.score).toBe(0);
    expect(result.riskLevel).toBe("low");
    expect(result.triggeredFactors).toHaveLength(0);
  });
});
