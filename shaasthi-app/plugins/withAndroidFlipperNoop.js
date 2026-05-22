const { withDangerousMod } = require("@expo/config-plugins");
const path = require("path");

function withAndroidFlipperNoop(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const script = path.join(cfg.modRequest.projectRoot, "scripts/patch-android-flipper.js");
      require(script).patchAndroidFlipper(cfg.modRequest.platformProjectRoot);
      return cfg;
    },
  ]);
}

module.exports = withAndroidFlipperNoop;
