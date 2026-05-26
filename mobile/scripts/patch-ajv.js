const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const AJV_KEYWORDS_DIR = path.join(__dirname, "..", "node_modules", "ajv-keywords");
const NESTED_AJV_DIR = path.join(AJV_KEYWORDS_DIR, "node_modules", "ajv");

if (!fs.existsSync(NESTED_AJV_DIR)) {
  fs.mkdirSync(path.dirname(NESTED_AJV_DIR), { recursive: true });
  execSync("npm install --ignore-scripts --no-audit --no-fund ajv@8.20.0", {
    cwd: AJV_KEYWORDS_DIR,
    stdio: "ignore",
  });
  console.log("patched ajv-keywords — installed nested ajv@8.20.0");
}
