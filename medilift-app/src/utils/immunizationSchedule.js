import { addDays, addMonths, addYears, formatISO, parseISO, isBefore, differenceInCalendarDays } from "date-fns";

function toDate(input) {
  if (input instanceof Date) return input;
  if (typeof input === "string") return parseISO(input.slice(0, 10));
  return new Date(input);
}

/** NHM-style schedule keys — due dates from DOB */
export function calculateVaccineDates(dateOfBirth) {
  const dob = toDate(dateOfBirth);
  return {
    OPV_0: addDays(dob, 0),
    HEPB: addDays(dob, 0),
    BCG: addDays(dob, 0),
    OPV_1: addDays(dob, 45),
    PENTA_1: addDays(dob, 45),
    ROTA_1: addDays(dob, 45),
    PCV_1: addDays(dob, 45),
    IPV_1: addDays(dob, 45),
    OPV_2: addDays(dob, 75),
    PENTA_2: addDays(dob, 75),
    ROTA_2: addDays(dob, 75),
    OPV_3: addDays(dob, 105),
    PENTA_3: addDays(dob, 105),
    ROTA_3: addDays(dob, 105),
    PCV_2: addDays(dob, 105),
    IPV_2: addDays(dob, 105),
    MR_1: addMonths(dob, 9),
    JE_1: addMonths(dob, 9),
    VITA_1: addMonths(dob, 9),
    PCV_B: addMonths(dob, 9),
    DPT_B1: addMonths(dob, 18),
    OPV_B: addMonths(dob, 18),
    MR_2: addMonths(dob, 18),
    JE_2: addMonths(dob, 18),
    VITA_2: addMonths(dob, 18),
    DPT_B2: addYears(dob, 5),
    TT_10: addYears(dob, 10),
    TT_16: addYears(dob, 16),
  };
}

export function isoDate(d) {
  return formatISO(d, { representation: "date" });
}

export function isVaccineOverdue(dueDate) {
  const d = typeof dueDate === "string" ? parseISO(dueDate) : dueDate;
  return isBefore(d, new Date()) && !isSameDay(d, new Date());
}

function isSameDay(a, b) {
  return a.toDateString() === b.toDateString();
}

export function getDaysOverdue(dueDate) {
  const d = typeof dueDate === "string" ? parseISO(dueDate) : dueDate;
  return Math.max(0, differenceInCalendarDays(new Date(), d));
}

/** administeredList: array of vaccine_code strings */
export function getNextDueVaccine(vaccineDates, administeredList = []) {
  const admin = new Set(administeredList);
  const entries = Object.entries(vaccineDates).sort(
    ([, a], [, b]) => toDate(a).getTime() - toDate(b).getTime()
  );
  for (const [code, due] of entries) {
    if (!admin.has(code) && !isBefore(toDate(due), addDays(new Date(), -1))) {
      return { code, dueDate: toDate(due) };
    }
  }
  for (const [code, due] of entries) {
    if (!admin.has(code)) return { code, dueDate: toDate(due) };
  }
  return null;
}
