export const labels = {
  appName: { en: "Shaasthi Pilot", hi: "सास्थी पायलट" },
  phone: { en: "Mobile number", hi: "मोबाइल नंबर" },
  otp: { en: "One-time password", hi: "ओटीपी" },
  consent: { en: "Consent recorded", hi: "सहमति दर्ज" },
  saveLocal: { en: "Save offline", hi: "ऑफलाइन सेव करें" },
  syncNow: { en: "Sync now", hi: "अभी सिंक करें" },
  risk: { en: "Risk", hi: "जोखिम" },
  addPatient: { en: "Add patient", hi: "लाभार्थी जोड़ें" },
};

export function bilingual(entry) {
  return `${entry.en} / ${entry.hi}`;
}
