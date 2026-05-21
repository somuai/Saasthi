import { FEATURES } from "../constants/featureFlags";
export function isFeatureEnabled(name) {
  return !!FEATURES[name];
}
