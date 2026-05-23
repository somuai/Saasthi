const DAY_MS = 24 * 60 * 60 * 1000;

export function toDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`);
  return date;
}

export function addDays(dateValue, days) {
  const date = toDate(dateValue);
  return new Date(date.getTime() + days * DAY_MS);
}

export function daysBetween(start, end) {
  return Math.floor((toDate(end).getTime() - toDate(start).getTime()) / DAY_MS);
}

export function calculateAgeYears(dob, asOf = new Date().toISOString()) {
  const birth = toDate(dob);
  const at = toDate(asOf);
  let age = at.getFullYear() - birth.getFullYear();
  const birthdayPassed = at.getMonth() > birth.getMonth() || (at.getMonth() === birth.getMonth() && at.getDate() >= birth.getDate());
  if (!birthdayPassed) age -= 1;
  return age;
}

export function calculateGestationalAge(lmpDate, asOf = new Date().toISOString()) {
  const totalDays = Math.max(0, daysBetween(lmpDate, asOf));
  return {
    weeks: Math.floor(totalDays / 7),
    days: totalDays % 7,
    totalDays,
  };
}

export function estimateDueDate(lmpDate) {
  return addDays(lmpDate, 280).toISOString().slice(0, 10);
}

export function trimesterForWeeks(weeks) {
  if (weeks < 13) return 1;
  if (weeks < 28) return 2;
  return 3;
}
