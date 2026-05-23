const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const POD_LINE = "  pod 'simdjson', :path => '../node_modules/@nozbe/simdjson'";

function withWatermelonSimdjson(config) {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, "Podfile");
      let contents = fs.readFileSync(podfilePath, "utf8");
      if (!contents.includes("pod 'simdjson'")) {
        contents = contents.replace(/use_expo_modules!\n/, `use_expo_modules!\n${POD_LINE}\n`);
        fs.writeFileSync(podfilePath, contents);
      }
      return cfg;
    },
  ]);
}

module.exports = withWatermelonSimdjson;
