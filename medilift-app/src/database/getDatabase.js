import { isWatermelonNativeAvailable } from "./isNativeAvailable";
import { createDatabase } from "./createDatabase";

let instance = null;

export function getDatabase() {
  if (!isWatermelonNativeAvailable()) {
    throw new Error(
      "WMDatabaseBridge is not available. Build with: cd medilift-app && npm run native:ios"
    );
  }
  if (!instance) {
    instance = createDatabase();
  }
  return instance;
}
