import { FEATURES, INCENTIVE_RATES } from "../constants/featureFlags";
export function useAllFeatureFlags() {
  return { flags: FEATURES, rates: INCENTIVE_RATES };
}
