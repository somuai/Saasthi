#!/usr/bin/env node
/** Run risk golden fixtures (used by eval/scenarios/risk_golden.py). */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, "../medilift-app/package.json"));
const { scorePatient } = require("../medilift-app/src/ml/riskScorer.js");

const fixtures = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures/risk_golden.json"), "utf8")
);

let failed = 0;
for (const c of fixtures.cases) {
  const r = scorePatient(c.patient || {}, c.survey || null, c.mcpData || null);
  const exp = c.expect;
  let ok = true;
  const errs = [];
  if (exp.minScore != null && r.score < exp.minScore) {
    ok = false;
    errs.push(`score ${r.score} < min ${exp.minScore}`);
  }
  if (exp.maxScore != null && r.score > exp.maxScore) {
    ok = false;
    errs.push(`score ${r.score} > max ${exp.maxScore}`);
  }
  if (exp.levels && !exp.levels.includes(r.riskLevel)) {
    ok = false;
    errs.push(`level ${r.riskLevel} not in ${exp.levels.join(",")}`);
  }
  if (exp.factors?.length) {
    for (const f of exp.factors) {
      if (!r.triggeredFactors.some((t) => t.factor === f)) {
        ok = false;
        errs.push(`missing factor ${f}`);
      }
    }
  }
  if (ok) {
    console.log(`PASS ${c.id}`);
  } else {
    failed += 1;
    console.error(`FAIL ${c.id}: ${errs.join("; ")}`);
  }
}
process.exit(failed ? 1 : 0);
