import { COLORS, colors as palette } from "./colors";

export { COLORS };
/** @deprecated use COLORS — kept for gradual migration */
export const colors = palette;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
};

export const tapTarget = 52;

export const typography = {
  title: { fontSize: 24, lineHeight: 32, fontWeight: "800", color: palette.text },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: "800", color: palette.text },
  body: { fontSize: 15, lineHeight: 22, color: palette.text },
  label: { fontSize: 13, lineHeight: 18, fontWeight: "700", color: palette.muted },
};
