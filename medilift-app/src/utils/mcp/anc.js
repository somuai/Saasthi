import { addDays, calculateGestationalAge, estimateDueDate } from "./dateHelpers";

const ANC_VISITS = [
  { code: "anc_1", label: "ANC 1", labelHi: "एएनसी 1", dueWeek: 12 },
  { code: "anc_2", label: "ANC 2", labelHi: "एएनसी 2", dueWeek: 20 },
  { code: "anc_3", label: "ANC 3", labelHi: "एएनसी 3", dueWeek: 28 },
  { code: "anc_4", label: "ANC 4", labelHi: "एएनसी 4", dueWeek: 34 },
];

export function getAncPlan({ lmpDate, completedCodes = [], asOf = new Date().toISOString() }) {
  const gestationalAge = calculateGestationalAge(lmpDate, asOf);
  const visits = ANC_VISITS.map((visit) => {
    const dueDate = addDays(lmpDate, visit.dueWeek * 7).toISOString().slice(0, 10);
    const completed = completedCodes.includes(visit.code);
    const overdue = !completed && gestationalAge.weeks > visit.dueWeek + 1;
    const dueNow = !completed && gestationalAge.weeks >= visit.dueWeek && !overdue;
    return { ...visit, dueDate, completed, dueNow, overdue };
  });
  const nextVisit = visits.find((visit) => !visit.completed) || null;
  return { gestationalAge, estimatedDueDate: estimateDueDate(lmpDate), visits, nextVisit };
}
