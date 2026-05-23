import { addDays, daysBetween } from "./dateHelpers";

export const immunizationSchedule = [
  { code: "bcg", label: "BCG", labelHi: "बीसीजी", dueDays: 0 },
  { code: "opv_0", label: "OPV 0", labelHi: "ओपीवी 0", dueDays: 0 },
  { code: "hep_b_birth", label: "Hep B birth dose", labelHi: "हेप बी जन्म खुराक", dueDays: 0 },
  { code: "penta_1", label: "Pentavalent 1", labelHi: "पेंटावेलेंट 1", dueDays: 42 },
  { code: "opv_1", label: "OPV 1", labelHi: "ओपीवी 1", dueDays: 42 },
  { code: "rota_1", label: "Rotavirus 1", labelHi: "रोटावायरस 1", dueDays: 42 },
  { code: "penta_2", label: "Pentavalent 2", labelHi: "पेंटावेलेंट 2", dueDays: 70 },
  { code: "penta_3", label: "Pentavalent 3", labelHi: "पेंटावेलेंट 3", dueDays: 98 },
  { code: "mr_1", label: "MR 1", labelHi: "एमआर 1", dueDays: 270 },
  { code: "dpt_booster_1", label: "DPT booster 1", labelHi: "डीपीटी बूस्टर 1", dueDays: 480 },
];

export function getImmunizationStatus({ dob, givenCodes = [], asOf = new Date().toISOString(), graceDays = 7 }) {
  return immunizationSchedule.map((item) => {
    const dueDate = addDays(dob, item.dueDays).toISOString().slice(0, 10);
    const ageAtCheck = daysBetween(dob, asOf);
    const given = givenCodes.includes(item.code);
    return {
      ...item,
      dueDate,
      given,
      status: given ? "given" : ageAtCheck > item.dueDays + graceDays ? "overdue" : ageAtCheck >= item.dueDays ? "due" : "upcoming",
    };
  });
}

export function getDueVaccines(args) {
  return getImmunizationStatus(args).filter((item) => item.status === "due" || item.status === "overdue");
}
