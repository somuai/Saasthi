/** Survey draft AsyncStorage helpers — testable without mounting SurveyScreen. */

export function draftKey(patientId) {
  return `medilift_survey_draft_${patientId}`;
}

/**
 * @param {string|null|undefined} rawDraft JSON from AsyncStorage
 * @param {object|null} patient Watermelon patient model or plain object
 * @param {() => object} emptyForm
 * @param {(form: object, patient: object) => object} prefillFn
 */
export function mergeDraftOrPrefill(rawDraft, patient, emptyForm, prefillFn) {
  const base = emptyForm();
  if (!patient) return base;

  if (rawDraft) {
    try {
      const parsed = JSON.parse(rawDraft);
      if (parsed && typeof parsed === "object") {
        return { ...base, ...parsed };
      }
    } catch {
      /* invalid draft — fall through to prefill */
    }
  }

  return prefillFn(base, patient);
}
