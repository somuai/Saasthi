import PropTypes from "prop-types";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../constants/colors";
import { BilingualLabel } from "./BilingualLabel";
import { localizePair, useLocale } from "../utils/localization";

export function ToggleRow({ labelHi, labelEn, value, onChange, required, disabled }) {
  const locale = useLocale();
  const select = (v) => !disabled && onChange?.(v);
  return (
    <View style={[styles.card, disabled && styles.disabled]}>
      <View style={styles.left}>
        <BilingualLabel labelHi={labelHi} labelEn={labelEn} required={required} />
      </View>
      <View style={styles.pills}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Yes"
          onPress={() => select(true)}
          style={({ pressed }) => [styles.pill, value === true && styles.yesOn, pressed && { transform: [{ scale: 0.95 }] }]}
        >
          <Text style={[styles.pillText, value === true && styles.pillOnText]}>{localizePair("हां", "YES", locale)}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="No"
          onPress={() => select(false)}
          style={({ pressed }) => [styles.pill, value === false && styles.noOn, pressed && { transform: [{ scale: 0.95 }] }]}
        >
          <Text style={[styles.pillText, value === false && styles.pillOnText]}>{localizePair("नहीं", "NO", locale)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

ToggleRow.propTypes = {
  labelHi: PropTypes.string.isRequired,
  labelEn: PropTypes.string.isRequired,
  value: PropTypes.bool,
  onChange: PropTypes.func,
  required: PropTypes.bool,
  disabled: PropTypes.bool,
};

const styles = StyleSheet.create({
  card: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    backgroundColor: COLORS.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 8,
  },
  disabled: { opacity: 0.55 },
  left: { flex: 1, paddingRight: 8 },
  pills: { flexDirection: "row", gap: 8 },
  pill: {
    width: 80,
    minHeight: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
  },
  yesOn: { backgroundColor: COLORS.success, borderWidth: 0 },
  noOn: { backgroundColor: COLORS.danger, borderWidth: 0 },
  pillText: { fontSize: 11, fontWeight: "700", color: COLORS.textSecondary },
  pillOnText: { color: "#fff" },
});
