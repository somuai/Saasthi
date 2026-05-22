/**
 * Patches expo-dev-menu for Xcode 16+ / Swift 6 where TARGET_IPHONE_SIMULATOR
 * is not visible in Swift source. Safe to run repeatedly (idempotent).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SWIFT_FILE = path.join(
  ROOT,
  "node_modules/expo-dev-menu/ios/DevMenuViewController.swift"
);

const OLD = "    let isSimulator = TARGET_IPHONE_SIMULATOR > 0";
const NEW = `#if targetEnvironment(simulator)
    let isSimulator = true
#else
    let isSimulator = false
#endif`;

function patchExpoDevMenu() {
  if (!fs.existsSync(SWIFT_FILE)) {
    console.log("[patch-expo-dev-menu] expo-dev-menu not installed — skip");
    return;
  }
  const contents = fs.readFileSync(SWIFT_FILE, "utf8");
  if (contents.includes("targetEnvironment(simulator)")) {
    console.log("[patch-expo-dev-menu] already patched");
    return;
  }
  if (!contents.includes(OLD)) {
    console.warn("[patch-expo-dev-menu] unexpected DevMenuViewController.swift — manual check needed");
    return;
  }
  fs.writeFileSync(SWIFT_FILE, contents.replace(OLD, NEW));
  console.log("[patch-expo-dev-menu] patched DevMenuViewController.swift");
}

patchExpoDevMenu();
