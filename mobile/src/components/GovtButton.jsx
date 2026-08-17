import PropTypes from "prop-types";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../constants/colors";
import { tapTarget } from "../constants/design";
import { translateHindiText, useLocale } from "../utils/localization";

export function GovtButton({ titleHi, titleEn, onPress, variant = "primary", disabled, loading, accessibilityLabel }) {
  const locale = useLocale();
  const isPrimary = variant === "primary";
  const primaryTitle = locale === "en" ? titleEn || titleHi : translateHindiText(titleHi, locale);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || `${primaryTitle} ${titleEn || ""}`.trim()}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? "#fff" : COLORS.primary} />
      ) : (
        <View style={styles.textCol}>
          <Text style={[styles.hi, isPrimary && styles.onPrimary]}>{primaryTitle}</Text>
          {titleEn && locale !== "en" ? <Text style={[styles.en, isPrimary && styles.onPrimaryMuted]}>{titleEn}</Text> : null}
        </View>
      )}
    </Pressable>
  );
}

GovtButton.propTypes = {
  titleHi: PropTypes.string.isRequired,
  titleEn: PropTypes.string,
  onPress: PropTypes.func.isRequired,
  variant: PropTypes.oneOf(["primary", "secondary"]),
  disabled: PropTypes.bool,
  loading: PropTypes.bool,
  accessibilityLabel: PropTypes.string,
};

const styles = StyleSheet.create({
  base: {
    minHeight: tapTarget,
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: { backgroundColor: COLORS.accent },
  secondary: {
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ scale: 0.98 }] },
  textCol: { alignItems: "center" },
  hi: { fontSize: 16, fontWeight: "700", color: COLORS.textPrimary },
  en: { fontSize: 11, marginTop: 2, color: COLORS.textSecondary },
  onPrimary: { color: "#fff" },
  onPrimaryMuted: { color: "rgba(255,255,255,0.85)" },
});
