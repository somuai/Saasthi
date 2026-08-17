import { useFonts } from "expo-font";
import { NotoSans_400Regular, NotoSans_700Bold } from "@expo-google-fonts/noto-sans";
import { NotoSansDevanagari_400Regular } from "@expo-google-fonts/noto-sans-devanagari";
import { NotoSansBengali_400Regular } from "@expo-google-fonts/noto-sans-bengali";

/** Keys must match `FONTS` in src/constants/typography.js */
const SHAASTHI_FONT_MAP = {
  NotoSans: NotoSans_400Regular,
  "NotoSans-Bold": NotoSans_700Bold,
  "NotoSans-Devanagari": NotoSansDevanagari_400Regular,
  "NotoSans-Bengali": NotoSansBengali_400Regular,
};

export function useShaasthiFonts() {
  return useFonts(SHAASTHI_FONT_MAP);
}
