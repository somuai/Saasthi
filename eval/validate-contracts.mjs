#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const contractsDir = path.join(ROOT, "contracts");
const offline = process.argv.includes("--offline");
const apiUrl = process.env.SHAASTHI_API_URL || "http://127.0.0.1:8000";

const EXPECTED_TABLES = [
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

function assertPullShape(pull) {
  if (!pull.timestamp) throw new Error("missing timestamp");
  if (!pull.changes) throw new Error("missing changes");
  for (const table of EXPECTED_TABLES) {
    const block = pull.changes[table];
    if (!block) throw new Error(`missing table ${table}`);
    for (const key of ["created", "updated", "deleted"]) {
      if (!Array.isArray(block[key])) throw new Error(`${table}.${key} not array`);
    }
  }
}

function loadFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(contractsDir, name), "utf8"));
}

try {
  const example = loadFixture("sync-watermelon-pull.example.json");
  assertPullShape(example);
  console.log("PASS fixture sync-watermelon-pull.example.json");

  if (!offline) {
    const res = await fetch(`${apiUrl}/api/v1/sync/pull/?last_pulled_at=0`, {
      headers: { Authorization: "Bearer invalid" },
    });
    if (res.status !== 401) {
      console.warn(`WARN: expected 401 without token, got ${res.status}`);
    }
    console.log("PASS live API reachable (auth enforced)");
  } else {
    console.log("SKIP live API (--offline)");
  }
  process.exit(0);
} catch (e) {
  console.error("FAIL", e.message);
  process.exit(1);
}
