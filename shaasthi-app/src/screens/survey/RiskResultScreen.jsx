import { useMemo } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ShaasthiTopBar } from "../../components/ShaasthiTopBar";
import { FactorChip } from "../../components/FactorChip";
import { GovtButton } from "../../components/GovtButton";
import { COLORS } from "../../constants/colors";
import { FEATURES } from "../../constants/featureFlags";
import { RISK_LEVEL_COLORS } from "../../ml/riskConstants";
import { getRecommendation } from "../../ml/riskScorer";
import { tapTargetMin } from "../../constants/typography";

const CATEGORIES = [
  { key: "communicable", hi: "संक्रामक", en: "Communicable" },
  { key: "chronic", hi: "जीर्ण", en: "Chronic" },
  { key: "critical", hi: "गंभीर", en: "Critical" },
  { key: "maternal", hi: "मातृत्व", en: "Maternal" },
  { key: "general", hi: "सामान्य", en: "General" },
];

const SOURCE_LABELS = {
  rule_template: { en: "Rule Engine", hi: "नियम इंजन", color: COLORS.textSecondary },
  gemma4_api: { en: "AI Enhanced", hi: "AI उन्नत", color: "#8B5CF6" },
  tflite: { en: "On-Device AI", hi: "डिवाइस AI", color: "#2563EB" },
};

const URGENCY_LABELS = {
  immediate: { en: "Immediate action required", hi: "तत्काल कार्रवाई आवश्यक", color: "#DC2626" },
  within_24h: { en: "Act within 24 hours", hi: "24 घंटे के अंदर कार्रवाई करें", color: "#EA580C" },
  within_3_days: { en: "Schedule within 3 days", hi: "3 दिनों में शेड्यूल करें", color: "#CA8A04" },
  routine: { en: "Routine follow-up", hi: "सामान्य फॉलो-अप", color: COLORS.textHint },
};

function inferCategory(factors, riskLevel) {
  const text = (factors || []).map((f) => `${f.labelHi || ""} ${f.label || ""}`).join(" ").toLowerCase();
  if (text.includes("cough") || text.includes("fever") || text.includes("खांसी") || text.includes("बुखार")) {
    return "communicable";
  }
  if (text.includes("diabetes") || text.includes("bp") || text.includes("मधुमेह")) return "chronic";
  if (text.includes("pregnant") || text.includes("pregnancy") || text.includes("गर्भ")) return "maternal";
  if (riskLevel === "critical" || riskLevel === "high") return "critical";
  return "general";
}

export default function RiskResultScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const patientName = params.patientName || "Patient";
  const score = Number(params.score || 0);
  const riskLevel = params.riskLevel || "medium";
  const factors = useMemo(() => {
    try {
      return JSON.parse(params.factors || "[]");
    } catch {
      return [];
    }
  }, [params.factors]);
  const recommendationSource = params.recommendationSource || "rule_template";
  const recEn = params.recEn || "";
  const recHi = params.recHi || "";
  const recUrgency = params.recUrgency || "routine";

  const activeCategory = inferCategory(factors, riskLevel);
  const riskColor = RISK_LEVEL_COLORS[riskLevel] || COLORS.warning;
  const pct = Math.min(99, Math.max(1, Math.round(score)));

  const sourceInfo = SOURCE_LABELS[recommendationSource] || SOURCE_LABELS.rule_template;
  const urgencyInfo = URGENCY_LABELS[recUrgency] || URGENCY_LABELS.routine;

  async function onShare() {
    await Share.share({
      message: `Shaasthi assessment: ${patientName} — ${pct}% (${riskLevel}). ${recEn}.`,
    });
  }

  return (
    <View style={styles.page}>
      <ShaasthiTopBar
        titleHi="मूल्यांकन परिणाम"
        titleEn="Assessment Result"
        showBack
        rightComponent={
          <Pressable onPress={onShare} style={styles.iconBtn} accessibilityLabel="Share">
            <Ionicons name="share-outline" size={22} color="#fff" />
          </Pressable>
        }
      />
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scroll}>
        <View style={[styles.hero, { borderColor: riskColor }]}>
          <View style={[styles.ring, { borderColor: riskColor, backgroundColor: riskColor }]}>
            <Text style={styles.pct}>{pct}%</Text>
            <Text style={styles.level}>{riskLevel.toUpperCase()}</Text>
          </View>
          <Text style={styles.patientName}>{patientName}</Text>
          <Text style={styles.heroHi}>मूल्यांकन परिणाम</Text>
          <Text style={styles.heroEn}>Assessment saved offline</Text>
        </View>

        <View style={styles.urgencyRow}>
          <View style={[styles.urgencyBadge, { borderColor: urgencyInfo.color }]}>
            <Ionicons name="timer-outline" size={14} color={urgencyInfo.color} />
            <Text style={[styles.urgencyText, { color: urgencyInfo.color }]}>
              {urgencyInfo.hi} / {urgencyInfo.en}
            </Text>
          </View>
        </View>

        {(recHi || recEn) ? (
          <View style={styles.recCard}>
            <Text style={styles.recTitleHi}>सिफारिश</Text>
            <Text style={styles.recTitleEn}>Recommendation</Text>
            <Text style={styles.recTextHi}>{recHi}</Text>
            <Text style={styles.recTextEn}>{recEn}</Text>
            <View style={styles.sourceRow}>
              <View style={[styles.sourceBadge, { backgroundColor: sourceInfo.color + "20", borderColor: sourceInfo.color }]}>
                <Ionicons name={recommendationSource === "gemma4_api" ? "sparkles" : recommendationSource === "tflite" ? "phone-portrait" : "settings"} size={12} color={sourceInfo.color} />
                <Text style={[styles.sourceText, { color: sourceInfo.color }]}>{sourceInfo.en}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionHi}>संभावित श्रेणी</Text>
        <Text style={styles.sectionEn}>Likely category</Text>
        <View style={styles.catRow}>
          {CATEGORIES.map((c) => {
            const on = c.key === activeCategory;
            return (
              <View key={c.key} style={[styles.catChip, on && { backgroundColor: COLORS.warning, borderColor: COLORS.warning }]}>
                <Text style={[styles.catTxt, on && { color: COLORS.textPrimary, fontWeight: "800" }]}>{c.hi}</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionHi}>यह स्कोर क्यों?</Text>
        <Text style={styles.sectionEn}>Why this score?</Text>
        <View style={styles.chips}>
          {factors.length === 0 ? (
            <Text style={styles.muted}>कोई कारक नहीं / No factors triggered</Text>
          ) : (
            factors.map((f, i) => (
              <FactorChip
                key={`${f.label}-${i}`}
                label={f.labelHi || f.label || "Factor"}
                variant={f.weight >= 15 ? "high" : f.weight >= 8 ? "medium" : "safe"}
              />
            ))
          )}
        </View>

        <GovtButton
          titleHi="मरीज प्रोफाइल"
          titleEn="Patient profile"
          onPress={() => router.replace(`/(tabs)/patients/${params.patientId}`)}
        />
        <View style={{ height: 12 }} />
        <GovtButton titleHi="होम" titleEn="Home" variant="secondary" onPress={() => router.replace("/(tabs)/home")} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  scrollContainer: { flex: 1 },
  scroll: { flexGrow: 1, padding: 16, paddingBottom: 40 },
  iconBtn: { minWidth: tapTargetMin, minHeight: tapTargetMin, alignItems: "center", justifyContent: "center" },
  hero: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 2,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  ring: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 6,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  pct: { color: "#fff", fontSize: 28, fontWeight: "900" },
  level: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  patientName: { fontSize: 20, fontWeight: "900", color: COLORS.textPrimary, marginTop: 4 },
  heroHi: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
  heroEn: { fontSize: 11, color: COLORS.textHint },
  urgencyRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  urgencyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceContainer,
  },
  urgencyText: { fontSize: 11, fontWeight: "700" },
  recCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recTitleHi: { fontSize: 14, fontWeight: "800", color: COLORS.textPrimary },
  recTitleEn: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 8 },
  recTextHi: { fontSize: 15, fontWeight: "700", color: COLORS.textPrimary, lineHeight: 22, marginBottom: 4 },
  recTextEn: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 20, marginBottom: 8 },
  sourceRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  sourceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },
  sourceText: { fontSize: 10, fontWeight: "700" },
  sectionHi: { fontSize: 14, fontWeight: "800", color: COLORS.textPrimary },
  sectionEn: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 8 },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceContainer,
    minHeight: tapTargetMin,
    justifyContent: "center",
  },
  catTxt: { fontSize: 12, color: COLORS.textSecondary },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  muted: { color: COLORS.textSecondary, marginBottom: 16 },
});
