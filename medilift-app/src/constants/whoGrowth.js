/** Simplified WHO boys weight-for-age reference (median kg) — MVP charting */
export const WHO_WFA_MEDIAN_BOYS = {
  0: 3.3,
  1: 4.5,
  2: 5.6,
  3: 6.4,
  4: 7.0,
  5: 7.5,
  6: 7.9,
  9: 8.9,
  12: 9.6,
  15: 10.3,
  18: 10.9,
  24: 12.2,
  36: 14.3,
  48: 16.3,
  60: 18.3,
};

export const WHO_WFA_SD_BOYS = 0.85;

export function weightForAgeZ(weightKg, ageMonths) {
  const w = Number(weightKg);
  const m = Number(ageMonths);
  if (!w || m < 0) return null;
  const keys = Object.keys(WHO_WFA_MEDIAN_BOYS).map(Number).sort((a, b) => a - b);
  let median = WHO_WFA_MEDIAN_BOYS[keys[keys.length - 1]];
  for (let i = 0; i < keys.length; i += 1) {
    if (m <= keys[i]) {
      median = WHO_WFA_MEDIAN_BOYS[keys[i]];
      break;
    }
  }
  const z = (w - median) / WHO_WFA_SD_BOYS;
  return Math.round(z * 100) / 100;
}

export function classifyNutrition(z) {
  if (z == null) return "unknown";
  if (z < -3) return "sam";
  if (z < -2) return "mam";
  if (z < -1) return "underweight";
  if (z <= 1) return "normal";
  return "overweight";
}

export function nutritionLabel(status) {
  const map = {
    sam: "SAM / गंभीर कुपोषण",
    mam: "MAM / मध्यम कुपोषण",
    underweight: "Underweight / कम वजन",
    normal: "Normal / सामान्य",
    overweight: "Overweight / अधिक वजन",
    unknown: "—",
  };
  return map[status] || status;
}
