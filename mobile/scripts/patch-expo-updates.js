const fs = require("fs");
const path = require("path");

const TARGET = "node_modules/expo-updates/android/src/main/java/expo/modules/updates/UpdatesPackage.kt";

const file = path.join(__dirname, "..", TARGET);
if (!fs.existsSync(file)) {
  process.exit(0);
}

let content = fs.readFileSync(file, "utf-8");
const original = content;

content = content.replace(/^\s+override fun onReactInstanceException[\s\S]*?^\s+\}\n/gm, "");

content = content.replace(/(import\s+[\w.]+)/g, (m) => {
  if (m.includes("onReactInstanceException")) return "";
  return m;
});

if (content !== original) {
  fs.writeFileSync(file, content);
  console.log("patched expo-updates UpdatesPackage.kt — removed onReactInstanceException override");
}
