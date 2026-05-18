import { useFonts } from "expo-font";
import { NotoSans_400Regular, NotoSans_700Bold } from "@expo-google-fonts/noto-sans";
import { NotoSansDevanagari_400Regular } from "@expo-google-fonts/noto-sans-devanagari";

/** Keys must match `FONTS` in src/constants/typography.js */
const MEDILIFT_FONT_MAP = {
  NotoSans: NotoSans_400Regular,
  "NotoSans-Bold": NotoSans_700Bold,
  "NotoSans-Devanagari": NotoSansDevanagari_400Regular,
};

export function useMediliftFonts() {
  return useFonts(MEDILIFT_FONT_MAP);
}
