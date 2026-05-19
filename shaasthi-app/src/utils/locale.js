import AsyncStorage from "@react-native-async-storage/async-storage";

export const LOCALE_KEY = "app_locale";

export const LOCALES = [
  { id: "hi", label: "हिं", full: "Hindi" },
  { id: "en", label: "EN", full: "English" },
  { id: "bn", label: "বাং", full: "Bengali" },
  { id: "ta", label: "த", full: "Tamil" },
  { id: "te", label: "తె", full: "Telugu" },
];

export async function getStoredLocale() {
  try {
    const v = await AsyncStorage.getItem(LOCALE_KEY);
    return v || "hi";
  } catch {
    return "hi";
  }
}

export async function setStoredLocale(localeId) {
  await AsyncStorage.setItem(LOCALE_KEY, localeId);
}
