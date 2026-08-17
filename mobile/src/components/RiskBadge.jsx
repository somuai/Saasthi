import { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { Animated, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../constants/colors";
import { translateHindiText, useLocale } from "../utils/localization";

const HINDI = {
  low: "सामान्य",
  medium: "मध्यम",
  high: "उच्च",
  critical: "गंभीर",
};

const SIZE_MAP = {
  sm: { w: 60, h: 22, hi: 10, en: 8 },
  md: { w: 80, h: 28, hi: 12, en: 10 },
  lg: { w: 100, h: 36, hi: 14, en: 11 },
};

const LEVEL_COLORS = {
  low: COLORS.riskLow,
  medium: COLORS.riskMedium,
  high: COLORS.riskHigh,
  critical: COLORS.riskCritical,
};

export function RiskBadge({ risk, riskLevel, score, showScore, size = "md" }) {
  const locale = useLocale();
  const level = (riskLevel || risk?.riskLevel || "low").toLowerCase();
  const numScore = score ?? risk?.score ?? 0;
  const dim = SIZE_MAP[size] || SIZE_MAP.md;
  const bg = LEVEL_COLORS[level] || COLORS.textHint;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (level !== "critical") return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [level, pulse]);

  const inner = (
    <View
      style={[
        styles.pill,
        {
          width: dim.w,
          minHeight: dim.h,
          backgroundColor: bg,
          borderWidth: level === "critical" ? 2 : 0,
          borderColor: COLORS.danger,
        },
      ]}
    >
      <Text style={[styles.hi, { fontSize: dim.hi }]}>
        {locale === "en" ? level.toUpperCase() : translateHindiText(HINDI[level] || level, locale)}
      </Text>
      {locale === "en" ? null : <Text style={[styles.en, { fontSize: dim.en }]}>{level.toUpperCase()}</Text>}
      {showScore ? <Text style={styles.score}>{Math.round(numScore)}/100</Text> : null}
    </View>
  );

  if (level === "critical") {
    return (
      <Animated.View style={{ transform: [{ scale: pulse }] }} accessibilityRole="text">
        {inner}
      </Animated.View>
    );
  }
  return inner;
}

RiskBadge.propTypes = {
  risk: PropTypes.shape({
    riskLevel: PropTypes.string,
    score: PropTypes.number,
  }),
  riskLevel: PropTypes.string,
  score: PropTypes.number,
  showScore: PropTypes.bool,
  size: PropTypes.oneOf(["sm", "md", "lg"]),
};

const styles = StyleSheet.create({
  pill: {
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  hi: { color: "#fff", fontWeight: "800" },
  en: { color: "#fff", fontWeight: "600", opacity: 0.95 },
  score: { color: "#fff", fontSize: 9, marginTop: 1, fontWeight: "700" },
});
