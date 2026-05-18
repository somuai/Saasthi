import {
  buildFicIncentiveIfEligible,
  FIC_CORE_VACCINES,
  isFicComplete,
} from "../src/utils/ficIncentive";

describe("ficIncentive", () => {
  const dob = "2024-01-15";

  it("isFicComplete when all core vaccines given", () => {
    expect(isFicComplete(dob, FIC_CORE_VACCINES)).toBe(true);
  });

  it("buildFicIncentiveIfEligible returns payload once", () => {
    const fic = buildFicIncentiveIfEligible({
      dateOfBirth: dob,
      administeredCodes: FIC_CORE_VACCINES,
      existingActionTypes: [],
    });
    expect(fic).toMatchObject({ actionType: "FIC_COMPLETE", amountInr: 50 });
    expect(
      buildFicIncentiveIfEligible({
        dateOfBirth: dob,
        administeredCodes: FIC_CORE_VACCINES,
        existingActionTypes: ["FIC_COMPLETE"],
      })
    ).toBeNull();
  });
});
