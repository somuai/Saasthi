/**
 * Static audit: user-input persistence keys stay stable (device smoke in RUNBOOK.md).
 */
import {
  AUTH_PENDING_LOCALE_KEY,
  AUTH_PENDING_PHONE_KEY,
  AUTH_USER_KEY,
  AUTH_WORKER_KEY,
} from "../src/features/auth/authSession";
import { draftKey } from "../src/screens/survey/surveyDraft";

describe("user input storage keys", () => {
  it("auth session keys are stable", () => {
    expect(AUTH_USER_KEY).toBe("medilift_auth_user_json");
    expect(AUTH_WORKER_KEY).toBe("medilift_auth_worker_json");
    expect(AUTH_PENDING_PHONE_KEY).toBe("medilift_auth_pending_phone");
    expect(AUTH_PENDING_LOCALE_KEY).toBe("medilift_auth_pending_locale");
  });

  it("survey draft key is per-patient", () => {
    expect(draftKey("p1")).toBe("medilift_survey_draft_p1");
  });
});
