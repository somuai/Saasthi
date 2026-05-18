const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { resolveAndroidSdk } = require("./resolve-android-sdk");

const sdk = resolveAndroidSdk();
if (!sdk) {
  console.error(
    "\n[android] No Android SDK found.\n" +
      "1. Install Android Studio: https://developer.android.com/studio\n" +
      "2. SDK Manager → install Android 14 (API 34) + Emulator\n" +
      "3. Device Manager → Create Virtual Device (e.g. Pixel 6, API 34)\n" +
      "4. Add to ~/.zshrc:\n" +
      "   export ANDROID_HOME=$HOME/Library/Android/sdk\n" +
      "   export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools\n"
  );
  process.exit(1);
}

const adb = path.join(sdk, "platform-tools", "adb");
const emulatorBin = path.join(sdk, "emulator", "emulator");
const env = {
  ...process.env,
  ANDROID_HOME: sdk,
  ANDROID_SDK_ROOT: sdk,
  PATH: `${path.join(sdk, "platform-tools")}:${path.join(sdk, "emulator")}:${process.env.PATH || ""}`,
};

function run(cmd, args) {
  const r = spawnSync(cmd, args, { env, encoding: "utf8" });
  return { ok: r.status === 0, out: (r.stdout || "") + (r.stderr || "") };
}

function hasBootedDevice() {
  const { ok, out } = run(adb, ["devices"]);
  if (!ok) return false;
  return out
    .split("\n")
    .slice(1)
    .some((line) => line.trim().endsWith("device"));
}

function listAvds() {
  const { ok, out } = run(emulatorBin, ["-list-avds"]);
  if (!ok) return [];
  return out
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function pickAvd(avds) {
  const preferred = process.env.ANDROID_AVD || "MediLift_API_34";
  if (avds.includes(preferred)) return preferred;
  return avds[0];
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForBoot(maxMs = 180000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (hasBootedDevice()) {
      const boot = run(adb, ["shell", "getprop", "sys.boot_completed"]);
      if (boot.ok && boot.out.trim() === "1") return true;
    }
    await sleep(2000);
  }
  return false;
}

async function main() {
  if (hasBootedDevice()) {
    console.log("[android] device/emulator already connected");
    process.exit(0);
  }

  const avds = listAvds();
  if (avds.length === 0) {
    console.error(
      "\n[android] No AVD found. In Android Studio → Device Manager → Create Device\n" +
        "  Name it MediLift_API_34 (API 34) or set ANDROID_AVD=YourAvdName\n"
    );
    process.exit(1);
  }

  const avd = pickAvd(avds);
  console.log(`[android] starting emulator: ${avd}`);

  const logDir = path.join(__dirname, "..", ".expo");
  fs.mkdirSync(logDir, { recursive: true });
  const log = fs.openSync(path.join(logDir, "emulator.log"), "a");

  const child = spawn(emulatorBin, ["-avd", avd], {
    env,
    detached: true,
    stdio: ["ignore", log, log],
  });
  child.unref();

  const ready = await waitForBoot();
  if (!ready) {
    console.error("[android] emulator did not boot in time — open Android Studio → Device Manager");
    process.exit(1);
  }
  console.log("[android] emulator ready");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
