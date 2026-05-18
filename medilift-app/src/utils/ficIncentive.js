import { calculateVaccineDates } from "./immunizationSchedule";

/** Core primary-series vaccines for FIC (Fully Immunized Child) pilot milestone. */
export const FIC_CORE_VACCINES = [
  "BCG",
  "HEPB",
  "OPV_0",
  "PENTA_1",
  "PENTA_2",
  "PENTA_3",
  "OPV_1",
  "OPV_2",
  "OPV_3",
  "MR_1",
];

export function isFicComplete(dateOfBirth, administeredCodes) {
  if (!dateOfBirth) return false;
  const admin = new Set(administeredCodes || []);
  return FIC_CORE_VACCINES.every((code) => admin.has(code));
}

export function ficProgress(dateOfBirth, administeredCodes) {
  if (!dateOfBirth) return { done: 0, total: FIC_CORE_VACCINES.length };
  const admin = new Set(administeredCodes || []);
  const done = FIC_CORE_VACCINES.filter((c) => admin.has(c)).length;
  return { done, total: FIC_CORE_VACCINES.length };
}

/** Returns incentive payload fields or null if not yet eligible / already awarded. */
export function buildFicIncentiveIfEligible({ dateOfBirth, administeredCodes, existingActionTypes = [] }) {
  if (!isFicComplete(dateOfBirth, administeredCodes)) return null;
  if (existingActionTypes.includes("FIC_COMPLETE")) return null;
  const today = new Date().toISOString().slice(0, 10);
  return {
    actionType: "FIC_COMPLETE",
    points: 25,
    amountInr: 50,
    periodDate: today,
    descriptionHi: "पूर्ण टीकाकरण (FIC)",
    descriptionEn: "Fully immunized child (FIC)",
  };
}

export function scheduleCodesForDob(dateOfBirth) {
  return Object.keys(calculateVaccineDates(dateOfBirth));
}
