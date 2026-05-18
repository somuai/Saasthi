const { withDangerousMod } = require("@expo/config-plugins");
const path = require("path");

/** Re-apply expo-dev-menu Swift patch during expo prebuild / run:ios */
function withExpoDevMenuSimulatorFix(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const script = path.join(cfg.modRequest.projectRoot, "scripts/patch-expo-dev-menu.js");
      require(script);
      return cfg;
    },
  ]);
}

module.exports = withExpoDevMenuSimulatorFix;
