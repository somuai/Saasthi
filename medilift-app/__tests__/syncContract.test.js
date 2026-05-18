import fs from "fs";
import path from "path";

const contractsDir = path.resolve(__dirname, "../../contracts");

describe("sync contract fixtures", () => {
  it("pull response matches Watermelon table keys", () => {
    const pull = JSON.parse(
      fs.readFileSync(path.join(contractsDir, "sync-watermelon-pull.example.json"), "utf8")
    );
    expect(pull).toHaveProperty("timestamp");
    expect(pull).toHaveProperty("changes");
    const expected = [
      "patients",
      "households",
      "survey_responses",
      "follow_ups",
      "mother_records",
      "immunization_records",
      "growth_records",
      "flags",
      "referrals",
      "incentive_records",
      "anc_visit_records",
      "child_development",
    ];
    for (const table of expected) {
      expect(pull.changes[table]).toEqual(
        expect.objectContaining({ created: expect.any(Array), updated: expect.any(Array), deleted: expect.any(Array) })
      );
    }
  });

  it("push payload includes device metadata", () => {
    const push = JSON.parse(fs.readFileSync(path.join(contractsDir, "sync-push.example.json"), "utf8"));
    expect(push).toHaveProperty("changes");
    expect(push.changes.patients.created[0]).toHaveProperty("id");
    expect(push.changes.patients.created[0]).toHaveProperty("patient_code");
  });
});
