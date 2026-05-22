export const LOCALES = {
  hi: "हिन्दी",
  en: "English",
  bn: "বাংলা",
  te: "తెలుగు",
  kn: "ಕನ್ನಡ",
};

export const labels = {
  appName: { hi: "सास्थी पायलट", en: "Shaasthi Pilot", bn: "স্বাস্থী পাইলট", te: "సాస్తి పైలట్", kn: "ಸಾಸ್ತಿ ಪೈಲಟ್" },
  phone: { hi: "मोबाइल नंबर", en: "Mobile number", bn: "মোবাইল নম্বর", te: "మొబైల్ నంబర్", kn: "ಮೊಬೈಲ್ ಸಂಖ್ಯೆ" },
  otp: { hi: "ओटीपी", en: "One-time password", bn: "ওটিপি", te: "ఓటీపీ", kn: "ಒಟಿಪಿ" },
  consent: { hi: "सहमति दर्ज", en: "Consent recorded", bn: "সম্মতি রেকর্ড", te: "సమ్మతి నమోదు", kn: "ಸಮ್ಮತಿ ದಾಖಲಾಗಿದೆ" },
  saveLocal: { hi: "ऑफलाइन सेव करें", en: "Save offline", bn: "অফলাইন সংরক্ষণ", te: "ఆఫ్‌లైన్ సేవ్", kn: "ಆಫ್‌ಲೈನ್ ಉಳಿಸು" },
  syncNow: { hi: "अभी सिंक करें", en: "Sync now", bn: "এখন সিঙ্ক", te: "ఇప్పుడు సింక్", kn: "ಈಗ ಸಿಂಕ್ ಮಾಡಿ" },
  risk: { hi: "जोखिम", en: "Risk", bn: "ঝুঁকি", te: "ప్రమాదం", kn: "ಅಪಾಯ" },
  addPatient: { hi: "लाभार्थी जोड़ें", en: "Add patient", bn: "লাভার্থী যোগ", te: "లాభార్థి జోడించు", kn: "ಲಾಭಾರ್ಥಿ ಸೇರಿಸು" },
};

const DEFAULT_LOCALE = "hi";
const FALLBACK_LOCALE = "en";

export function t(key, locale) {
  const entry = labels[key];
  if (!entry) return key;
  return entry[locale] || entry[DEFAULT_LOCALE] || entry[FALLBACK_LOCALE] || key;
}

export function bilingual(entry) {
  return `${entry.hi} / ${entry.en}`;
}

export function displayPair(locale) {
  if (locale === "hi") return { primary: "hi", secondary: "en" };
  return { primary: locale, secondary: "en" };
}
