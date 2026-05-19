const { withDangerousMod } = require("@expo/config-plugins");
const path = require("path");

function withAndroidLocalProperties(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const script = path.join(cfg.modRequest.projectRoot, "scripts/write-android-local-properties.js");
      require(script).writeLocalProperties();
      return cfg;
    },
  ]);
}

module.exports = withAndroidLocalProperties;
