import { NativeModules } from "react-native";

/** True only in a dev/production build with WatermelonDB linked (not Expo Go). */
export function isWatermelonNativeAvailable() {
  return Boolean(NativeModules?.WMDatabaseBridge);
}
