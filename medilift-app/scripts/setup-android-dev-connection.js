#!/usr/bin/env node
/**
 * Android emulator cannot reach the host LAN IP reliably.
 * Forward Metro (8081) so http://localhost:8081 on the device hits the Mac.
 */
const { spawnSync } = require("child_process");
const path = require("path");
const { resolveAndroidSdk } = require("./resolve-android-sdk");

function main() {
  const sdk = resolveAndroidSdk();
  if (!sdk) {
    console.warn("[android] SDK not found — skip adb reverse (connect a device manually)");
    return;
  }

  const adb = path.join(sdk, "platform-tools", "adb");
  const env = {
    ...process.env,
    ANDROID_HOME: sdk,
    ANDROID_SDK_ROOT: sdk,
    PATH: `${path.join(sdk, "platform-tools")}:${process.env.PATH || ""}`,
  };

  const list = spawnSync(adb, ["devices"], { env, encoding: "utf8" });
  const hasDevice =
    list.status === 0 &&
    (list.stdout || "")
      .split("\n")
      .slice(1)
      .some((line) => line.trim().endsWith("device"));

  if (!hasDevice) {
    console.warn("[android] no adb device — start emulator first");
    return;
  }

  let ok = true;
  for (const port of [8081, 8082]) {
    const r = spawnSync(adb, ["reverse", `tcp:${port}`, `tcp:${port}`], { env, encoding: "utf8" });
    if (r.status === 0) {
      console.log(`[android] adb reverse tcp:${port} → host (dev client: http://localhost:${port})`);
    } else {
      ok = false;
      console.warn(`[android] adb reverse tcp:${port} failed: ${(r.stderr || r.stdout || "").trim()}`);
    }
  }
  if (!ok) process.exit(1);
}

main();
