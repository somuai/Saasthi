const fs = require("fs");
const path = require("path");

const TARGET = "node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle";
const METHOD = `
ext.useDefaultAndroidSdkVersions = {
  android {
    compileSdkVersion project.ext.safeExtGet("compileSdkVersion", 34)
    defaultConfig {
      minSdkVersion project.ext.safeExtGet("minSdkVersion", 23)
      targetSdkVersion project.ext.safeExtGet("targetSdkVersion", 34)
    }
  }
}
`;

const file = path.join(__dirname, TARGET);
if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, "utf-8");
  if (!content.includes("ext.useDefaultAndroidSdkVersions")) {
    content = content.trimEnd() + "\n" + METHOD;
    fs.writeFileSync(file, content);
    console.log("patched ExpoModulesCorePlugin.gradle with useDefaultAndroidSdkVersions");
  }
}
