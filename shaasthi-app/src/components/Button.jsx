import { Pressable, StyleSheet, Text } from "react-native";
import { colors, radii, tapTarget } from "../constants/design";

export function Button({ label, onPress, variant = "primary", disabled = false }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === "secondary" && styles.secondary,
        variant === "quiet" && styles.quiet,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.text, variant !== "primary" && styles.secondaryText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    justifyContent: "center",
    minHeight: tapTarget,
    paddingHorizontal: 18,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderWidth: 1,
  },
  quiet: { backgroundColor: "transparent" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.82 },
  text: { color: colors.surface, fontSize: 15, fontWeight: "800" },
  secondaryText: { color: colors.primary },
});
