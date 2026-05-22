const fs = require("fs");
const path = require("path");
const { resolveAndroidSdk } = require("./resolve-android-sdk");

const ROOT = path.join(__dirname, "..");
const ANDROID_DIR = path.join(ROOT, "android");
const LOCAL_PROPS = path.join(ANDROID_DIR, "local.properties");

function writeLocalProperties() {
  if (!fs.existsSync(ANDROID_DIR)) {
    console.log("[android] android/ not found — run expo prebuild first");
    return false;
  }
  const sdk = resolveAndroidSdk();
  if (!sdk) {
    console.error(
      "[android] Android SDK not found. Install Android Studio and set ANDROID_HOME, e.g.\n" +
        "  export ANDROID_HOME=$HOME/Library/Android/sdk"
    );
    return false;
  }
  const escaped = sdk.replace(/\\/g, "\\\\");
  fs.writeFileSync(LOCAL_PROPS, `sdk.dir=${escaped}\n`);
  console.log(`[android] wrote local.properties → ${sdk}`);
  return true;
}

if (require.main === module) {
  writeLocalProperties();
}

module.exports = { writeLocalProperties };
