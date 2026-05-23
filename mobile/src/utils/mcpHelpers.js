import { addDays, differenceInCalendarWeeks, parseISO, formatISO } from "date-fns";

export function calculateEDD(lmpDate) {
  const lmp = typeof lmpDate === "string" ? parseISO(lmpDate.slice(0, 10)) : lmpDate;
  return addDays(lmp, 280);
}

export function calculatePOG(lmpDate) {
  if (!lmpDate) return 0;
  const lmp = typeof lmpDate === "string" ? parseISO(lmpDate.slice(0, 10)) : lmpDate;
  return differenceInCalendarWeeks(new Date(), lmp, { rounding: "floor" });
}

export function getANCDueDates(lmpDate) {
  const lmp = typeof lmpDate === "string" ? parseISO(lmpDate.slice(0, 10)) : lmpDate;
  return {
    anc1: addDays(lmp, 56),
    anc2: addDays(lmp, 112),
    anc3: addDays(lmp, 168),
    anc4: addDays(lmp, 224),
  };
}

/** ancVisits: array of { visitDate?: string } */
export function calculateANCStatus(ancVisits = []) {
  const completed = ancVisits.filter((v) => v?.visitDate).length;
  const target = 4;
  const sorted = [...ancVisits]
    .filter((v) => v?.visitDate)
    .sort((a, b) => parseISO(a.visitDate).getTime() - parseISO(b.visitDate).getTime());
  const last = sorted[sorted.length - 1];
  const nextDue = last ? addDays(parseISO(last.visitDate), 56) : null;
  return {
    completed,
    target,
    nextDue,
    isOnTrack: completed >= target,
    isHighRisk: ancVisits.some((v) => v?.bpSystolic >= 140 || v?.hemoglobinGm < 11),
  };
}

export function isPMMVYEligible(patientLike) {
  if (!patientLike) return false;
  return Boolean(patientLike.isPmmvyEligible || patientLike.is_pmmvy_eligible);
}

export function isoFromDate(d) {
  return formatISO(d, { representation: "date" });
}
