import PropTypes from "prop-types";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MotiView } from "moti";
import { useRouter } from "expo-router";
import { COLORS } from "../constants/colors";
import { RiskBadge } from "./RiskBadge";
import { localizePair, translateHindiText, useLocale } from "../utils/localization";

function initials(name) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return (p[0][0] + (p[1]?.[0] || "")).toUpperCase().slice(0, 2);
}

function avatarStyles(level) {
  switch ((level || "").toLowerCase()) {
    case "critical":
      return { bg: "rgba(255, 0, 0, 0.12)", text: "#D32F2F" };
    case "high":
    case "medium":
      return { bg: "rgba(247, 165, 190, 0.25)", text: "#C2185B" };
    default:
      return { bg: "rgba(65, 108, 175, 0.12)", text: "#1976D2" };
  }
}

function riskColor(level) {
  switch ((level || "").toLowerCase()) {
    case "critical":
      return COLORS.riskCritical;
    case "high":
      return COLORS.riskHigh;
    case "medium":
      return COLORS.riskMedium;
    default:
      return COLORS.riskLow;
  }
}

export function PatientCard({ patient, onPress, onSurveyPress }) {
  const router = useRouter();
  const locale = useLocale();
  const p = patient;
  const name = p?.name ?? "";
  const age = p?.age ?? "";
  const gender = p?.gender ?? "";
  const village = p?.village ?? p?.household?.village ?? "";
  const level = p?.riskLevel ?? p?.risk_level ?? "low";
  const score = p?.riskScore ?? p?.risk_score ?? 0;
  const last = p?.lastVisited ?? p?.last_visited ?? "";
  const pregnant = p?.isPregnant ?? p?.is_pregnant;
  const av = avatarStyles(level);

  return (
    <MotiView
      from={{ opacity: 0, translateY: 15 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 350 }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Patient ${name}`}
        onPress={onPress || (() => router.push(`/(tabs)/patients/${p.id}`))}
        style={({ pressed }) => [
          styles.card,
          { borderLeftColor: riskColor(level) },
          pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 }
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: av.bg }]}>
          <Text style={[styles.avatarText, { color: av.text }]}>{initials(name)}</Text>
        </View>
        <View style={styles.mid}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.meta}>
            {age}yr · {gender} · {village}
          </Text>
          {last ? (
            <Text style={styles.last} accessibilityLabel="Last visited">
              {last}
            </Text>
          ) : null}
          {pregnant ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{localizePair("गर्भवती", "Pregnant", locale)}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.right}>
          <RiskBadge riskLevel={level} score={score} size="sm" showScore />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start survey"
            style={({ pressed }) => [styles.surveyBtn, pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] }]}
            onPress={onSurveyPress || (() => router.push(`/(tabs)/survey/${p.id}`))}
          >
            <Text style={styles.surveyBtnText}>{translateHindiText("सर्वे", locale)} &gt;</Text>
          </Pressable>
        </View>
      </Pressable>
    </MotiView>
  );
}

PatientCard.propTypes = {
  patient: PropTypes.object.isRequired,
  onPress: PropTypes.func,
  onSurveyPress: PropTypes.func,
};

const styles = StyleSheet.create({
  card: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 16,
    marginHorizontal: 12,
    marginVertical: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderLeftWidth: 5,
    overflow: "hidden",
    shadowColor: "#1A1A2E",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 16, fontWeight: "800" },
  mid: { flex: 1, gap: 2, paddingLeft: 4 },
  name: { fontSize: 16, fontWeight: "800", color: COLORS.textPrimary },
  meta: { fontSize: 12, color: COLORS.textSecondary, fontWeight: "500" },
  last: { fontSize: 11, color: COLORS.textHint, marginTop: 2 },
  tag: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.navyLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  tagText: { fontSize: 10, color: COLORS.accent, fontWeight: "700" },
  right: { alignItems: "flex-end", gap: 10, maxWidth: 120 },
  surveyBtn: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: COLORS.navyLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(65, 108, 175, 0.15)",
  },
  surveyBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: "800" },
});
