import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, tapTarget } from "../constants/design";

export function ListRow({ title, subtitle, meta, onPress }) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : "text"}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && onPress && styles.pressed]}
    >
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: tapTarget,
    padding: spacing.lg,
  },
  pressed: { opacity: 0.82 },
  textWrap: { flex: 1, gap: 2 },
  title: { color: colors.text, fontSize: 16, fontWeight: "800" },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  meta: { color: colors.primary, fontSize: 13, fontWeight: "900" },
});
