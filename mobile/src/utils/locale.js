import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizeLocale, setRuntimeLocale } from "./localization";

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
    return setRuntimeLocale(normalizeLocale(v || "hi"));
  } catch {
    return setRuntimeLocale("hi");
  }
}

export async function setStoredLocale(localeId) {
  const next = setRuntimeLocale(localeId);
  await AsyncStorage.setItem(LOCALE_KEY, next);
  return next;
}
