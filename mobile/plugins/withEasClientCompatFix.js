const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const METHOD_IMPL = `\next.useDefaultAndroidSdkVersions = {
  android {
    compileSdkVersion project.ext.safeExtGet("compileSdkVersion", 34)
    defaultConfig {
      minSdkVersion project.ext.safeExtGet("minSdkVersion", 23)
      targetSdkVersion project.ext.safeExtGet("targetSdkVersion", 34)
    }
  }
}
`;

module.exports = function withEasClientCompatFix(config) {
  return withDangerousMod(config, [
    "android",
    (cfg) => {
      const pluginFile = path.join(
        cfg.modRequest.projectRoot,
        "node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle"
      );
      if (!fs.existsSync(pluginFile)) {
        return cfg;
      }
      let content = fs.readFileSync(pluginFile, "utf-8");
      if (!content.includes("ext.useDefaultAndroidSdkVersions")) {
        content = content.trimEnd() + "\n" + METHOD_IMPL;
        fs.writeFileSync(pluginFile, content);
      }
      return cfg;
    },
  ]);
};
