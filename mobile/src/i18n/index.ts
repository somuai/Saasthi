import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Placeholder translation resources
const resources = {
  en: {
    translation: {
      welcome: "Welcome to Shaasthi",
      syncing: "Syncing in background...",
      offline: "Offline - Changes saved locally",
    },
  },
  hi: {
    translation: {
      welcome: "शास्ती में आपका स्वागत है",
      syncing: "बैकग्राउंड में सिंक हो रहा है...",
      offline: "ऑफ़लाइन - परिवर्तन स्थानीय रूप से सहेजे गए",
    },
  },
  bn: {
    translation: {
      welcome: "স্বাস্থীতে স্বাগতম",
      syncing: "ব্যাকগ্রাউন্ডে সিঙ্ক হচ্ছে...",
      offline: "অফলাইন - পরিবর্তনগুলি লোকালি সংরক্ষিত হয়েছে",
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: "en", // default language
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
