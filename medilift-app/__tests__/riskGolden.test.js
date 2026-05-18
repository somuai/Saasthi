import fs from "fs";
import path from "path";
import { scorePatient } from "../src/ml/riskScorer";

const fixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../../eval/fixtures/risk_golden.json"), "utf8")
);

describe("risk golden fixtures", () => {
  fixtures.cases.forEach((c) => {
    it(c.id, () => {
      const r = scorePatient(c.patient || {}, c.survey || null, c.mcpData || null);
      const exp = c.expect;
      if (exp.minScore != null) expect(r.score).toBeGreaterThanOrEqual(exp.minScore);
      if (exp.maxScore != null) expect(r.score).toBeLessThanOrEqual(exp.maxScore);
      if (exp.levels) expect(exp.levels).toContain(r.riskLevel);
      if (exp.factors?.length) {
        exp.factors.forEach((f) => {
          expect(r.triggeredFactors.map((t) => t.factor)).toContain(f);
        });
      }
    });
  });
});
