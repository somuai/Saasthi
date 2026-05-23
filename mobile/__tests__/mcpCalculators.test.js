import { getAncPlan } from "../src/utils/mcp/anc";
import { calculateGestationalAge, estimateDueDate } from "../src/utils/mcp/dateHelpers";
import { getDueVaccines, getImmunizationStatus } from "../src/utils/mcp/immunization";
import { calculateBmi, classifyAdultBmi, classifyChildGrowth } from "../src/utils/mcp/growth";

describe("MCP date and ANC helpers", () => {
  it("calculates gestational age and due date from LMP", () => {
    expect(calculateGestationalAge("2026-01-01", "2026-03-15T00:00:00.000Z")).toEqual({
      weeks: 10,
      days: 3,
      totalDays: 73,
    });
    expect(estimateDueDate("2026-01-01")).toBe("2026-10-08");
  });

  it("marks overdue ANC visits when not completed", () => {
    const plan = getAncPlan({
      lmpDate: "2025-10-01",
      completedCodes: ["anc_1"],
      asOf: "2026-05-18T00:00:00.000Z",
    });

    expect(plan.gestationalAge.weeks).toBe(32);
    expect(plan.visits.find((visit) => visit.code === "anc_2").overdue).toBe(true);
    expect(plan.nextVisit.code).toBe("anc_2");
  });
});

describe("MCP immunization and growth helpers", () => {
  it("returns due and overdue vaccines", () => {
    const status = getImmunizationStatus({
      dob: "2026-03-01",
      givenCodes: ["bcg", "opv_0"],
      asOf: "2026-05-18T00:00:00.000Z",
    });
    expect(status.find((item) => item.code === "penta_1").status).toBe("overdue");
    expect(getDueVaccines({ dob: "2026-03-01", givenCodes: ["bcg", "opv_0"], asOf: "2026-05-18T00:00:00.000Z" })).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: "penta_1" })]),
    );
  });

  it("calculates BMI and simplified growth status", () => {
    const bmi = calculateBmi(48, 155);
    expect(bmi).toBe(20);
    expect(classifyAdultBmi(bmi)).toBe("normal");
    expect(classifyChildGrowth({ ageMonths: 18, weightKg: 7.5 }).status).toBe("severe_underweight");
  });
});
