#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const PACKAGE_PATH = path.join("in", "shaasthi", "pilot");
const MAIN_APPLICATION = path.join("app", "src", "main", "java", PACKAGE_PATH, "MainApplication.kt");
const DEBUG_FLIPPER = path.join("app", "src", "debug", "java", PACKAGE_PATH, "ReactNativeFlipper.java");

const FLIPPER_SHIM = `package in.shaasthi.pilot;

import android.content.Context;
import com.facebook.react.ReactInstanceManager;

public final class ReactNativeFlipper {
  private ReactNativeFlipper() {}

  public static void initializeFlipper(Context context, ReactInstanceManager reactInstanceManager) {
    // Expo dev-client probes this class by reflection; the app does not rely on Flipper.
  }
}
`;

function patchAndroidFlipper(androidProjectRoot = path.join(__dirname, "..", "android")) {
  if (!fs.existsSync(androidProjectRoot)) {
    return false;
  }

  const mainApplicationPath = path.join(androidProjectRoot, MAIN_APPLICATION);
  if (fs.existsSync(mainApplicationPath)) {
    let source = fs.readFileSync(mainApplicationPath, "utf8");
    source = source.replace(/\nimport com\.facebook\.react\.flipper\.ReactNativeFlipper\n/, "\n");
    source = source.replace(
      /\n    if \(BuildConfig\.DEBUG\) \{\n      ReactNativeFlipper\.initializeFlipper\(this, reactNativeHost\.reactInstanceManager\)\n    \}\n/,
      "\n"
    );
    fs.writeFileSync(mainApplicationPath, source, "utf8");
  }

  const shimPath = path.join(androidProjectRoot, DEBUG_FLIPPER);
  fs.mkdirSync(path.dirname(shimPath), { recursive: true });
  fs.writeFileSync(shimPath, FLIPPER_SHIM, "utf8");
  console.log(`[android] patched Flipper dev-client shim → ${shimPath}`);
  return true;
}

if (require.main === module) {
  patchAndroidFlipper();
}

module.exports = { patchAndroidFlipper };
