#!/usr/bin/env node
/**
 * Reverse the ports the dev client needs over USB:
 * - Metro on 8081
 * - Django API on 8000
 * - Expo fallback/dev-menu on 8082
 */
const { spawnSync } = require("child_process");
const path = require("path");
const { formatDevice, listAdbDevices, readyDevices } = require("./android-adb-devices");
const { resolveAndroidSdk } = require("./resolve-android-sdk");

function setupAndroidDevConnection() {
  const sdk = resolveAndroidSdk();
  if (!sdk) {
    console.warn("[android] SDK not found — skip adb reverse (connect a device manually)");
    return false;
  }

  const adb = path.join(sdk, "platform-tools", "adb");
  const env = {
    ...process.env,
    ANDROID_HOME: sdk,
    ANDROID_SDK_ROOT: sdk,
    PATH: `${path.join(sdk, "platform-tools")}:${process.env.PATH || ""}`,
  };

  const { devices, error } = listAdbDevices(adb, env);
  if (error) {
    console.warn(`[android] ${error}`);
    return false;
  }

  const connected = readyDevices(devices);
  const unauthorized = devices.filter((device) => device.state === "unauthorized");
  if (unauthorized.length > 0) {
    console.warn(`[android] unauthorized device(s): ${unauthorized.map(formatDevice).join(", ")}`);
  }

  const requestedSerial = process.env.ANDROID_SERIAL;
  const targets = requestedSerial
    ? connected.filter((device) => device.serial === requestedSerial)
    : connected;

  if (targets.length === 0) {
    const suffix = requestedSerial ? ` matching ANDROID_SERIAL=${requestedSerial}` : "";
    console.warn(`[android] no authorized adb device${suffix}`);
    return false;
  }

  let ok = true;
  for (const device of targets) {
    for (const port of [8000, 8081, 8082]) {
      const r = spawnSync(adb, ["-s", device.serial, "reverse", `tcp:${port}`, `tcp:${port}`], {
        env,
        encoding: "utf8",
      });
      if (r.status === 0) {
        console.log(
          `[android] ${formatDevice(device)} reverse tcp:${port} → host (dev client: http://localhost:${port})`
        );
      } else {
        ok = false;
        console.warn(
          `[android] ${formatDevice(device)} reverse tcp:${port} failed: ${(r.stderr || r.stdout || "").trim()}`
        );
      }
    }
  }
  return ok;
}

if (require.main === module) {
  if (!setupAndroidDevConnection()) process.exit(1);
}

module.exports = { setupAndroidDevConnection };
