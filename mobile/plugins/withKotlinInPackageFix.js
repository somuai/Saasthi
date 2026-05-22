const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/** Kotlin treats `in` as a keyword — package in.shaasthi.pilot must be `in`.shaasthi.pilot */
const INVALID = /^package in\.shaasthi\.pilot\s*$/m;
const FIXED = "package `in`.shaasthi.pilot";

function patchKotlinPackageFiles(androidProjectRoot) {
  const javaRoot = path.join(androidProjectRoot, "app", "src", "main", "java", "in", "shaasthi", "pilot");
  if (!fs.existsSync(javaRoot)) return;

  for (const name of ["MainActivity.kt", "MainApplication.kt"]) {
    const filePath = path.join(javaRoot, name);
    if (!fs.existsSync(filePath)) continue;
    const src = fs.readFileSync(filePath, "utf8");
    if (!INVALID.test(src)) continue;
    fs.writeFileSync(filePath, src.replace(INVALID, FIXED), "utf8");
  }
}

function withKotlinInPackageFix(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      patchKotlinPackageFiles(cfg.modRequest.platformProjectRoot);
      return cfg;
    },
  ]);
}

module.exports = withKotlinInPackageFix;
module.exports.patchKotlinPackageFiles = patchKotlinPackageFiles;
