import { COLORS } from "./colors";

export const FONTS = {
  regular: "NotoSans",
  bold: "NotoSans-Bold",
  devanagari: "NotoSans-Devanagari",
  bengali: "NotoSans-Bengali",
};

export const TYPOGRAPHY = {
  hindiPrimaryMd: { fontSize: 14, lineHeight: 20, fontFamily: FONTS.devanagari, color: COLORS.textPrimary },
  hindiPrimarySm: { fontSize: 12, lineHeight: 18, fontFamily: FONTS.devanagari, color: COLORS.textPrimary },
  bengaliPrimaryMd: { fontSize: 14, lineHeight: 20, fontFamily: FONTS.bengali, color: COLORS.textPrimary },
  bengaliPrimarySm: { fontSize: 12, lineHeight: 18, fontFamily: FONTS.bengali, color: COLORS.textPrimary },
  englishSecondaryMd: { fontSize: 11, lineHeight: 16, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  englishSecondarySm: { fontSize: 10, lineHeight: 14, fontFamily: FONTS.regular, color: COLORS.textSecondary },
  title: { fontSize: 22, lineHeight: 28, fontFamily: FONTS.bold, color: COLORS.textPrimary },
  header: { fontSize: 16, lineHeight: 22, fontFamily: FONTS.bold, color: COLORS.textPrimary },
};

/** Returns the appropriate script-specific font key for the given locale. */
export function scriptFontFamily(locale = "hi") {
  if (locale === "bn") return FONTS.bengali;
  if (locale === "hi") return FONTS.devanagari;
  return FONTS.regular;
}

export const tapTargetMin = 52;
