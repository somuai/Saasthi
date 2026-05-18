#!/usr/bin/env node
/**
 * Fix Kotlin package `in.medilift.pilot` — `in` is a reserved keyword.
 * Run after prebuild or via plugins/withKotlinInPackageFix.js.
 */
const path = require("path");
const { patchKotlinPackageFiles } = require("../plugins/withKotlinInPackageFix");

const androidRoot = path.join(__dirname, "..", "android");
patchKotlinPackageFiles(androidRoot);
console.log("[patch-android-kotlin-package] applied if needed");
