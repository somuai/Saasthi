import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radii, spacing, tapTarget } from "../constants/design";

export function TextField({ label, value, onChangeText, keyboardType, placeholder, multiline }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        style={[styles.input, multiline && styles.multiline]}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: tapTarget,
    paddingHorizontal: spacing.lg,
  },
  multiline: { minHeight: 96, paddingTop: spacing.md, textAlignVertical: "top" },
});
