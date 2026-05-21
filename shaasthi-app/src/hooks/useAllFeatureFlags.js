import { FEATURES, INCENTIVE_RATES } from "../constants/featureFlags";
export function getAllFeatureFlags() {
  return { flags: FEATURES, rates: INCENTIVE_RATES };
}
