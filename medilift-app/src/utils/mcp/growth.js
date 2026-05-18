export function calculateBmi(weightKg, heightCm) {
  const meters = Number(heightCm) / 100;
  if (!meters || !weightKg) return null;
  return Number((Number(weightKg) / (meters * meters)).toFixed(1));
}

export function classifyAdultBmi(bmi) {
  if (bmi === null || bmi === undefined) return "unknown";
  if (bmi < 18.5) return "underweight";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "overweight";
  return "obese";
}

export function expectedChildWeightKg(ageMonths) {
  if (ageMonths <= 12) return 3.2 + ageMonths * 0.55;
  if (ageMonths <= 60) return 9.8 + (ageMonths - 12) * 0.22;
  return 20.5 + (ageMonths - 60) * 0.28;
}

export function classifyChildGrowth({ ageMonths, weightKg }) {
  const expected = expectedChildWeightKg(Number(ageMonths));
  const percentOfExpected = (Number(weightKg) / expected) * 100;
  let status = "normal";
  if (percentOfExpected < 70) status = "severe_underweight";
  else if (percentOfExpected < 80) status = "moderate_underweight";
  else if (percentOfExpected > 120) status = "possible_overweight";

  return {
    expectedWeightKg: Number(expected.toFixed(1)),
    percentOfExpected: Number(percentOfExpected.toFixed(1)),
    status,
  };
}
