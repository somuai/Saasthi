import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing } from "../constants/design";

export function StatCard({ label, value, tone = "default" }) {
  return (
    <View style={[styles.card, tone === "warning" && styles.warning]}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  warning: { borderColor: "#FDBA74" },
  value: { color: colors.text, fontSize: 24, fontWeight: "900" },
  label: { color: colors.muted, fontSize: 13, fontWeight: "700" },
});
