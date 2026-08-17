import { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../constants/colors";
import { translateHindiText, useLocale } from "../utils/localization";

const OPTIONS = [
  { key: "mild", hi: "हल्का", en: "Mild", color: COLORS.success },
  { key: "moderate", hi: "मध्यम", en: "Moderate", color: COLORS.accent },
  { key: "severe", hi: "गंभीर", en: "Severe", color: COLORS.danger },
];

export function SeverityPill({ value, onChange }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const locale = useLocale();
  useEffect(() => {
    if (value !== "severe") return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value, pulse]);

  return (
    <View style={styles.row}>
      {OPTIONS.map((o) => {
        const selected = value === o.key;
        const pill = (
          <Pressable
            key={o.key}
            accessibilityRole="button"
            accessibilityLabel={`${o.en} severity`}
            onPress={() => onChange?.(o.key)}
            style={[styles.pill, { borderColor: o.color }, selected && { backgroundColor: o.color, borderWidth: 0 }]}
          >
            <Text style={[styles.hi, selected && styles.on]}>{locale === "en" ? o.en : translateHindiText(o.hi, locale)}</Text>
            {locale === "en" ? null : <Text style={[styles.en, selected && styles.on]}>{o.en}</Text>}
          </Pressable>
        );
        if (o.key === "severe" && selected) {
          return (
            <Animated.View key={o.key} style={{ transform: [{ scale: pulse }] }}>
              {pill}
            </Animated.View>
          );
        }
        return pill;
      })}
    </View>
  );
}

SeverityPill.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  pill: {
    width: 80,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
  },
  hi: { fontSize: 11, fontWeight: "700", color: COLORS.textPrimary },
  en: { fontSize: 9, color: COLORS.textSecondary },
  on: { color: "#fff" },
});
