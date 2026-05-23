#!/usr/bin/env node
/**
 * Open the dev client on a connected Android device with localhost Metro (requires adb reverse).
 */
const { spawnSync } = require("child_process");
const path = require("path");
const { formatDevice, listAdbDevices, readyDevices, selectDevice } = require("./android-adb-devices");
const { resolveAndroidSdk } = require("./resolve-android-sdk");
const { setupAndroidDevConnection } = require("./setup-android-dev-connection");

const http = require("http");
const METRO_URL = process.env.EXPO_METRO_URL || "http://localhost:8081";
const SCHEME = process.env.EXPO_DEV_CLIENT_SCHEME || "exp+shaasthi-pilot";

function metroReachable() {
  return new Promise((resolve) => {
    const req = http.get("http://127.0.0.1:8081/status", { timeout: 2000 }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  const sdk = resolveAndroidSdk();
  if (!sdk) {
    console.error("[android] SDK not found");
    process.exit(1);
  }

  const adb = path.join(sdk, "platform-tools", "adb");
  const env = {
    ...process.env,
    ANDROID_HOME: sdk,
    PATH: `${path.join(sdk, "platform-tools")}:${process.env.PATH || ""}`,
  };

  if (!setupAndroidDevConnection()) {
    process.exit(1);
  }

  const { devices, error } = listAdbDevices(adb, env);
  if (error) {
    console.error(`[android] ${error}`);
    process.exit(1);
  }

  const requestedSerial = process.env.ANDROID_SERIAL;
  const { device, ambiguous } = selectDevice(readyDevices(devices), requestedSerial);
  if (!device) {
    const suffix = requestedSerial ? ` matching ANDROID_SERIAL=${requestedSerial}` : "";
    console.error(`[android] no authorized adb device${suffix}`);
    process.exit(1);
  }
  if (ambiguous) {
    console.warn(`[android] multiple devices connected; launching ${formatDevice(device)}`);
  }

  const metroUp = await metroReachable();
  if (!metroUp) {
    console.error(
      "[android] Metro is not running on port 8081.\n" +
        "  In another terminal: cd mobile && npm run start:dev\n" +
        "  (Do not use plain npm start — use --localhost for the emulator.)",
    );
    process.exit(1);
  }

  const deepLink = `${SCHEME}://expo-development-client/?url=${encodeURIComponent(METRO_URL)}`;
  console.log(`[android] launching ${formatDevice(device)} dev client → ${METRO_URL}`);

  const r = spawnSync(adb, ["-s", device.serial, "shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", deepLink], {
    env,
    encoding: "utf8",
  });

  if (r.status !== 0) {
    console.error((r.stderr || r.stdout || "adb launch failed").trim());
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
