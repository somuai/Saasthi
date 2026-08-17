#!/usr/bin/env node

/**
 * Expo SDK 50 dependencies predate the Xcode SDK installed on this machine.
 * Keep the compatibility adjustments idempotent so a fresh npm install can
 * build both the iOS simulator and device targets without manual node_modules edits.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const patches = [
  {
    label: "react-native-voice Bluetooth option",
    file: path.join(root, "node_modules/@react-native-voice/voice/ios/Voice/Voice.m"),
    from: "AVAudioSessionCategoryOptionAllowBluetooth",
    to: "AVAudioSessionCategoryOptionAllowBluetoothHFP",
  },
  {
    label: "expo-device simulator check",
    file: path.join(root, "node_modules/expo-device/ios/UIDevice.swift"),
    from: "return TARGET_OS_SIMULATOR != 0",
    to: "#if targetEnvironment(simulator)\n    return true\n#else\n    return false\n#endif",
  },
  {
    label: "expo-gl valid extension set element type",
    file: path.join(root, "node_modules/expo-gl/common/EXGLNativeContext.h"),
    from: "std::set<const std::string> supportedExtensions;",
    to: "std::set<std::string> supportedExtensions;",
  },
];

for (const patch of patches) {
  if (!fs.existsSync(patch.file)) {
    console.log(`[patch-ios-native-compat] ${patch.label}: dependency not installed, skipping`);
    continue;
  }

  const source = fs.readFileSync(patch.file, "utf8");
  if (source.includes(patch.to)) {
    console.log(`[patch-ios-native-compat] ${patch.label}: already patched`);
    continue;
  }
  if (!source.includes(patch.from)) {
    console.warn(`[patch-ios-native-compat] ${patch.label}: expected source was not found`);
    continue;
  }

  fs.writeFileSync(patch.file, source.replaceAll(patch.from, patch.to));
  console.log(`[patch-ios-native-compat] ${patch.label}: patched`);
}
