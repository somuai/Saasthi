import { draftKey, mergeDraftOrPrefill } from "../src/screens/survey/surveyDraft";
import { emptySurveyForm, prefillHistoryFromPatient } from "../src/screens/survey/surveySubmit";

describe("surveyDraft", () => {
  const patient = {
    hospitalizedLastYear: true,
    regularMedicines: true,
    medicinesName: "Metformin",
    hasDiabetes: true,
    hasHypertension: false,
  };

  it("builds stable draft storage key", () => {
    expect(draftKey("abc123")).toBe("shaasthi_survey_draft_abc123");
  });

  it("prefers saved draft over patient prefill", () => {
    const draft = { ashaObservation: "draft note", hospitalizedLastYear: false };
    const form = mergeDraftOrPrefill(
      JSON.stringify(draft),
      patient,
      emptySurveyForm,
      prefillHistoryFromPatient
    );
    expect(form.ashaObservation).toBe("draft note");
    expect(form.hospitalizedLastYear).toBe(false);
    expect(form.medicinesName).toBe("");
    expect(form.regularMedicines).toBe(false);
  });

  it("prefills from patient when no draft", () => {
    const form = mergeDraftOrPrefill(null, patient, emptySurveyForm, prefillHistoryFromPatient);
    expect(form.hospitalizedLastYear).toBe(true);
    expect(form.regularMedicines).toBe(true);
    expect(form.medicinesName).toBe("Metformin");
    expect(form.chronicKnownBpDm).toBe(true);
  });

  it("falls back to prefill on invalid draft JSON", () => {
    const form = mergeDraftOrPrefill("{not-json", patient, emptySurveyForm, prefillHistoryFromPatient);
    expect(form.hospitalizedLastYear).toBe(true);
    expect(form.medicinesName).toBe("Metformin");
  });
});
