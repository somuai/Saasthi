const fs = require("fs");
const os = require("os");
const path = require("path");

function resolveAndroidSdk() {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(os.homedir(), "Library/Android/sdk"),
    path.join(os.homedir(), "Android/Sdk"),
  ].filter(Boolean);

  for (const sdk of candidates) {
    const emulator = path.join(sdk, "emulator", "emulator");
    const adb = path.join(sdk, "platform-tools", "adb");
    if (fs.existsSync(emulator) && fs.existsSync(adb)) {
      return sdk;
    }
  }
  return null;
}

module.exports = { resolveAndroidSdk };
