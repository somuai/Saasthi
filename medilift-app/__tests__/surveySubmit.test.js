import {
  buildSurveyPayload,
  detectTbRisk,
  computeSubmitSideEffects,
  emptySurveyForm,
  prefillHistoryFromPatient,
} from "../src/screens/survey/surveySubmit";
import { scorePatient } from "../src/ml/riskScorer";

describe("surveySubmit", () => {
  it("buildSurveyPayload maps snake_case for API flagging", () => {
    const form = emptySurveyForm();
    form.seriousBreathing = true;
    form.commCough2weeks = true;
    const p = buildSurveyPayload(form);
    expect(p.serious_severe_breathing).toBe(true);
    expect(p.comm_cough_2weeks).toBe(true);
    expect(p.visit_type).toBe("first");
  });

  it("prefillHistoryFromPatient copies chronic flags", () => {
    const f = prefillHistoryFromPatient(emptySurveyForm(), {
      hospitalizedLastYear: true,
      hasDiabetes: true,
      regularMedicines: true,
      medicinesName: "Metformin",
    });
    expect(f.hospitalizedLastYear).toBe(true);
    expect(f.chronicKnownBpDm).toBe(true);
    expect(f.medicinesName).toBe("Metformin");
  });

  it("detectTbRisk when cough and fever", () => {
    const form = emptySurveyForm();
    form.commCough2weeks = true;
    form.commFever3days = true;
    expect(detectTbRisk(form)).toBe(true);
  });

  it("computeSubmitSideEffects adds TB flag and follow-up", () => {
    const form = emptySurveyForm();
    form.commCough2weeks = true;
    form.commFever3days = true;
    const risk = scorePatient({ age: 30 }, buildSurveyPayload(form));
    const fx = computeSubmitSideEffects(form, risk, {});
    expect(fx.tbRisk).toBe(true);
    expect(fx.flags.some((f) => f.flagType === "TB_RISK")).toBe(true);
    expect(fx.followUps.some((f) => f.followType === "tb_screening")).toBe(true);
  });
});
