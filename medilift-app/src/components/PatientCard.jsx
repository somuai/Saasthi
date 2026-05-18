import PropTypes from "prop-types";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { COLORS } from "../constants/colors";
import { RiskBadge } from "./RiskBadge";

function initials(name) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return (p[0][0] + (p[1]?.[0] || "")).toUpperCase().slice(0, 2);
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
  const p = patient;
  const name = p?.name ?? "";
  const age = p?.age ?? "";
  const gender = p?.gender ?? "";
  const village = p?.village ?? p?.household?.village ?? "";
  const level = p?.riskLevel ?? p?.risk_level ?? "low";
  const score = p?.riskScore ?? p?.risk_score ?? 0;
  const last = p?.lastVisited ?? p?.last_visited ?? "";
  const pregnant = p?.isPregnant ?? p?.is_pregnant;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Patient ${name}`}
      onPress={onPress || (() => router.push(`/(tabs)/patients/${p.id}`))}
      style={[styles.card, { borderLeftColor: riskColor(level) }]}
    >
      <View style={[styles.avatar, { backgroundColor: riskColor(level) }]}>
        <Text style={styles.avatarText}>{initials(name)}</Text>
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
            <Text style={styles.tagText}>गर्भवती / Pregnant</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.right}>
        <RiskBadge riskLevel={level} score={score} size="sm" showScore />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start survey"
          style={styles.surveyBtn}
          onPress={onSurveyPress || (() => router.push(`/(tabs)/survey/${p.id}`))}
        >
          <Text style={styles.surveyBtnText}>सर्वे &gt;</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

PatientCard.propTypes = {
  patient: PropTypes.object.isRequired,
  onPress: PropTypes.func,
  onSurveyPress: PropTypes.func,
};

const styles = StyleSheet.create({
  card: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    marginHorizontal: 8,
    marginVertical: 4,
    padding: 12,
    borderLeftWidth: 4,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  mid: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: "800", color: COLORS.textPrimary },
  meta: { fontSize: 12, color: COLORS.textSecondary },
  last: { fontSize: 11, color: COLORS.textHint },
  tag: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.navyLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  tagText: { fontSize: 10, color: COLORS.accent, fontWeight: "700" },
  right: { alignItems: "flex-end", gap: 8, maxWidth: 120 },
  surveyBtn: {
    minHeight: 52,
    minWidth: 52,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  surveyBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
});
