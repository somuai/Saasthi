import PropTypes from "prop-types";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { translateHindiText, useLocale } from "../utils/localization";

const VARIANTS = {
  high: {
    bg: "#FFEBEE",
    border: COLORS.danger,
    text: COLORS.danger,
    icon: "alert-circle",
  },
  medium: {
    bg: COLORS.navyLight,
    border: COLORS.primary,
    text: COLORS.primary,
    icon: "warning",
  },
  safe: {
    bg: "#E8F5E9",
    border: COLORS.success,
    text: COLORS.success,
    icon: "checkmark-circle",
  },
};

export function FactorChip({ label, variant = "high" }) {
  const v = VARIANTS[variant] || VARIANTS.high;
  const locale = useLocale();
  return (
    <View style={[styles.chip, { backgroundColor: v.bg, borderColor: v.border }]}>
      <Ionicons name={v.icon} size={16} color={v.text} />
      <Text style={[styles.label, { color: v.text }]}>{translateHindiText(label, locale)}</Text>
    </View>
  );
}

FactorChip.propTypes = {
  label: PropTypes.string.isRequired,
  variant: PropTypes.oneOf(["high", "medium", "safe"]),
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 36,
  },
  label: { fontSize: 12, fontWeight: "600" },
});
