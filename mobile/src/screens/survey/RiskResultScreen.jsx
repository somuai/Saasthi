import { useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Animated, AppState, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { LottieWrapper } from "../../components/LottieWrapper";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDatabase } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { ShaasthiTopBar } from "../../components/ShaasthiTopBar";
import { GovtButton } from "../../components/GovtButton";
import { COLORS } from "../../constants/colors";
import { tapTargetMin } from "../../constants/typography";
import { translateHindiText, useLocale } from "../../utils/localization";
import { apiClient } from "../../api/client";
import { logger } from "../../utils/logger";

const GAUGE_SIZE = 132;
const GAUGE_STROKE = 9;
const GAUGE_RADIUS = (GAUGE_SIZE - GAUGE_STROKE) / 2;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

const RISK_META = {
  critical: { color: "#E24B4A", en: "Emergency Risk", hi: "आपात जोखिम" },
  high: { color: "#E24B4A", en: "High Risk", hi: "उच्च जोखिम" },
  medium: { color: "#FF9933", en: "Medium Risk", hi: "मध्यम जोखिम" },
  low: { color: "#138808", en: "Low Risk", hi: "सामान्य जोखिम" },
};

const CATEGORY_META = {
  communicable: { en: "Communicable", hi: "संचारी रोग" },
  chronic: { en: "Chronic", hi: "जीर्ण रोग" },
  critical: { en: "Critical", hi: "गंभीर" },
  maternal: { en: "Maternal", hi: "मातृत्व" },
  child: { en: "Child", hi: "बाल स्वास्थ्य" },
  demographic: { en: "Age", hi: "उम्र" },
  history: { en: "History", hi: "इतिहास" },
  social: { en: "Access", hi: "पहुंच" },
  general: { en: "General", hi: "सामान्य" },
};

const URGENCY_META = {
  immediate: { color: "#E24B4A", en: "IMMEDIATE", hi: "तुरंत", bn: "অবিলম্বে", days: 1 },
  within_24h: { color: "#FF9933", en: "WITHIN 24H", hi: "24 घंटे में", bn: "২৪ ঘণ্টার মধ্যে", days: 1 },
  within_3_days: { color: "#00897B", en: "WITHIN 3 DAYS", hi: "3 दिन में", bn: "৩ দিনের মধ্যে", days: 3 },
  routine: { color: COLORS.primary, en: "ROUTINE", hi: "नियमित जांच", bn: "নিয়মিত পরীক্ষা", days: 14 },
};

const SOURCE_META = {
  gemma4_api: { icon: "sparkles", color: "#00897B", en: "AI Recommendation", hi: "AI सिफारिश", bn: "AI সুপারিশ" },
  rule_template: { icon: "clipboard", color: COLORS.textSecondary, en: "NHM Guideline", hi: "NHM मार्गदर्शन", bn: "NHM নির্দেশিকা" },
  tflite: { icon: "phone-portrait", color: "#2563EB", en: "Offline Estimate", hi: "ऑफलाइन अनुमान", bn: "অফলাইন অনুমান" },
  processing: { icon: "sync", color: "#FF9933", en: "Analyzing…", hi: "विश्लेषण हो रहा…", bn: "বিশ্লেষণ চলছে…" },
};

function paramValue(value, fallback = "") {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

function bn(hi) {
  return translateHindiText(hi, "bn");
}

function displayHi(hi, locale) {
  return locale === "bn" ? bn(hi) : hi;
}

function indicText(hi, locale, en = "") {
  if (locale === "bn") return en ? `${bn(hi)} / ${en}` : bn(hi);
  if (locale === "en") return en || hi;
  return en ? `${hi} / ${en}` : hi;
}

function hiBnText(hi, locale, en = "") {
  if (locale === "en") return en || hi;
  return locale === "bn" ? bn(hi) : `${hi} / ${bn(hi)}`;
}

function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "--";
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function startOfTodayPlus(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseJsonParam(value, fallback) {
  try {
    return JSON.parse(paramValue(value, ""));
  } catch {
    return fallback;
  }
}

function normalizeFactors(factors) {
  return (Array.isArray(factors) ? factors : [])
    .map((factor) => ({
      key: factor.factor || factor.code || factor.name || factor.labelEn || factor.label || "factor",
      hi: factor.rule_label_hi || factor.labelHi || factor.label || factor.name || "जोखिम कारण",
      en: factor.rule_label_en || factor.labelEn || factor.label || factor.name || "Risk factor",
      category: factor.category || "general",
      weight: Number(factor.weight_contributed ?? factor.weight ?? factor.score ?? 1),
      isBackendWeight: factor.weight_contributed != null,
    }))
    .sort((a, b) => b.weight - a.weight);
}

function deriveCategories(factors, explicitPrimary) {
  const weights = {};
  factors.forEach((factor) => {
    weights[factor.category] = (weights[factor.category] || 0) + factor.weight;
  });
  const sorted = Object.entries(weights).sort((a, b) => b[1] - a[1]);
  const primary = explicitPrimary || sorted[0]?.[0] || "general";
  const secondary = sorted.map(([key]) => key).filter((key) => key !== primary);
  return { primary, secondary: secondary.length ? secondary : ["general"].filter((key) => key !== primary) };
}

function factorVariant(factor) {
  if (factor.isBackendWeight) {
    if (factor.weight >= 3) return "high";
    if (factor.weight >= 2) return "medium";
    return "low";
  }
  if (factor.weight >= 15) return "high";
  if (factor.weight >= 8) return "medium";
  return "low";
}

function checklistFor(riskLevel, primaryCategory, hardFlag) {
  if (hardFlag || primaryCategory === "maternal") {
    return [
      { hi: "मरीज को अकेले न जाने दें", en: "Do not let patient go alone" },
      { hi: "आपात संकेत हों तो 108 कॉल करें", en: "Call 108 if any danger sign" },
      { hi: "ANM को अभी सूचना दें", en: "Call ANM immediately" },
      { hi: "MCP कार्ड या रजिस्टर में रेफरल लिखें", en: "Document referral in MCP card/register" },
    ];
  }
  if (riskLevel === "high" || riskLevel === "critical") {
    return [
      { hi: "परिवार को मुख्य जोखिम बताएं", en: "Tell family what you observed" },
      { hi: "आज की तारीख रजिस्टर में लिखें", en: "Write today's date in register" },
      { hi: "ANM सुपरवाइजर को सूचित करें", en: "Inform ANM supervisor" },
      { hi: "24 घंटे में फॉलो-अप तय करें", en: "Schedule follow-up within 24 hours" },
    ];
  }
  if (riskLevel === "medium") {
    return [
      { hi: "परिवार से जोखिम कारण पर बात करें", en: "Discuss key risk factors with family" },
      { hi: "3 दिन में फॉलो-अप करें", en: "Schedule follow-up in 3 days" },
      { hi: "घर/मरीज रजिस्टर अपडेट करें", en: "Update household register" },
    ];
  }
  return [
    { hi: "परिवार को निगरानी जारी रखने को कहें", en: "Ask family to continue monitoring" },
    { hi: "2 हफ्ते में नियमित फॉलो-अप करें", en: "Plan routine follow-up in 2 weeks" },
  ];
}

function IndicLine({ hi, en, style, enStyle }) {
  const locale = useLocale();
  const primary = locale === "bn" ? bn(hi) : locale === "en" ? en || hi : hi;
  return (
    <View>
      <Text style={style}>{primary}</Text>
      {locale === "hi" ? <Text style={enStyle || styles.bengaliLine}>{bn(hi)}</Text> : null}
      {en && locale !== "en" ? <Text style={styles.englishLine}>{en}</Text> : null}
    </View>
  );
}

export default function RiskResultScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const database = useDatabase();
  const locale = useLocale();
  const patientId = paramValue(params.patientId);
  const patientName = paramValue(params.patientName, "Loading...");
  const patientAge = paramValue(params.patientAge);
  const patientGender = paramValue(params.patientGender);
  const localSurveyId = paramValue(params.surveyLocalId);
  const score = Math.min(100, Math.max(0, Math.round(Number(paramValue(params.score, 0)))));
  const riskLevel = String(paramValue(params.riskLevel, "medium")).toLowerCase();
  const riskInfo = RISK_META[riskLevel] || RISK_META.medium;
  const factors = useMemo(() => normalizeFactors(parseJsonParam(params.factors, [])), [params.factors]);
  const categories = useMemo(() => deriveCategories(factors, paramValue(params.primaryCategory)), [factors, params.primaryCategory]);
  const recommendationSource = paramValue(params.recommendationSource, "rule_template");
  const urgencyKey = paramValue(params.recUrgency, "routine");
  const recEn = paramValue(params.recEn);
  const recHi = paramValue(params.recHi) || "निगरानी जारी रखें। जरूरत हो तो PHC से संपर्क करें।";
  const hardFlag = paramValue(params.triggeredByHardFlag) === "true" || riskLevel === "critical";
  const hardFlagHi = paramValue(params.hardFlagMessageHi) || "आपात संकेत हो सकता है। तुरंत ANM/PHC से संपर्क करें।";
  const hardFlagEn = paramValue(params.hardFlagMessageEn) || "Possible emergency sign. Contact ANM/PHC immediately.";
  const checklist = useMemo(() => checklistFor(riskLevel, categories.primary, hardFlag), [riskLevel, categories.primary, hardFlag]);
  const checklistKey = `risk-result-checklist:${patientId}:${score}:${riskLevel}`;
  const [checked, setChecked] = useState({});

  // ── 5-state assessment lifecycle ──────────────────────────────
  const [serverData, setServerData] = useState(null);
  const [pollState, setPollState] = useState("idle"); // idle | processing | completed | error
  const pollAnim = useRef(new Animated.Value(0)).current;

  const assessmentState = useMemo(() => {
    if (hardFlag) return "hard_flag";
    if (serverData?.recommendation_source === "gemma4_api") return "ai_ready";
    if (serverData) return "server_ready";
    if (pollState === "processing") return "processing";
    return "offline";
  }, [hardFlag, serverData, pollState]);

  // Resolve displayed values — server overrides local when available
  const displaySource = useMemo(() => {
    if (assessmentState === "processing") return "processing";
    if (serverData?.recommendation_source) return serverData.recommendation_source;
    return recommendationSource;
  }, [assessmentState, serverData, recommendationSource]);
  const displaySourceInfo = SOURCE_META[displaySource] || SOURCE_META.rule_template;

  const displayScore = serverData?.normalized_score ?? serverData?.raw_score ?? score;
  const clampedScore = Math.min(100, Math.max(0, Math.round(Number(displayScore))));
  const displayRiskLevel = serverData?.risk_level ?? riskLevel;
  const displayRiskInfo = RISK_META[displayRiskLevel] || RISK_META.medium;
  const displayCategories = useMemo(() => {
    if (serverData?.categories) {
      return { primary: serverData.categories.primary, secondary: serverData.categories.secondary || [] };
    }
    return categories;
  }, [serverData, categories]);
  const displayFactors = useMemo(() => {
    if (serverData?.explanations) return normalizeFactors(serverData.explanations);
    return factors;
  }, [serverData, factors]);
  const displayUrgencyKey = serverData?.recommended_action?.urgency ?? urgencyKey;
  const displayUrgencyInfo = URGENCY_META[displayUrgencyKey] || URGENCY_META.routine;
  const displayRecEn = serverData?.recommended_action?.en ?? recEn;
  const displayRecHi = serverData?.recommended_action?.hi ?? recHi;

  const displayHardFlag = serverData?.triggered_by_hard_flag ?? hardFlag;
  const displayHardFlagHi = serverData?.hard_flag_message_hi ?? hardFlagHi;
  const displayHardFlagEn = serverData?.hard_flag_message_en ?? hardFlagEn;

  const displayChecklist = useMemo(() => {
    if (serverData?.protocol_checklist?.length) {
      return serverData.protocol_checklist.map((step) => ({
        hi: step.hi || "",
        en: step.en || "",
      }));
    }
    return checklistFor(displayRiskLevel, displayCategories.primary, displayHardFlag);
  }, [serverData, displayRiskLevel, displayCategories.primary, displayHardFlag]);
  const displayChecklistKey = `risk-result-checklist:${patientId}:${clampedScore}:${displayRiskLevel}`;
  const displayPctOffset = GAUGE_CIRCUMFERENCE * (1 - clampedScore / 100);
  const displayVisibleFactors = displayFactors.slice(0, 5);

  // ── Polling ────────────────────────────────────────────────
  useEffect(() => {
    if (!localSurveyId) return;

    let cancelled = false;
    let timer;
    let attempts = 0;
    const MAX_ATTEMPTS = 18;
    const INTERVAL_MS = 10000;

    async function poll() {
      if (cancelled) return;
      try {
        const { data } = await apiClient.get(`/risk/assessments/by-local-id/${localSurveyId}/`);
        if (cancelled) return;
        setServerData(data);
        setPollState("completed");
      } catch (err) {
        if (cancelled) return;
        if (err.response?.status === 202) {
          setPollState("processing");
          attempts++;
          if (attempts < MAX_ATTEMPTS) {
            timer = setTimeout(poll, INTERVAL_MS);
          } else {
            setPollState("error");
          }
        } else {
          setPollState("error");
        }
      }
    }

    const handleAppState = (nextAppState) => {
      if (nextAppState === "active" && pollState !== "completed" && pollState !== "error") {
        clearTimeout(timer);
        timer = setTimeout(poll, 1000);
      }
    };
    const sub = AppState.addEventListener("change", handleAppState);

    timer = setTimeout(poll, 3000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      sub.remove();
    };
  }, [localSurveyId]);

  // ── Pulse animation for processing state ───────────────────
  useEffect(() => {
    if (assessmentState === "processing") {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pollAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(pollAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
        ]),
      );
      anim.start();
      return () => anim.stop();
    }
    pollAnim.setValue(0);
  }, [assessmentState, pollAnim]);

  const pctOffset = displayPctOffset;
  const visibleFactors = displayVisibleFactors;

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(displayChecklistKey).then((raw) => {
      if (mounted && raw) setChecked(parseJsonParam(raw, {}));
    });
    return () => {
      mounted = false;
    };
  }, [displayChecklistKey]);

  async function toggleStep(index) {
    const next = { ...checked, [index]: !checked[index] };
    setChecked(next);
    await AsyncStorage.setItem(displayChecklistKey, JSON.stringify(next));
  }

  async function scheduleFollowUp() {
    if (!patientId) {
      router.replace("/(tabs)/followups");
      return;
    }
    const dueDate = startOfTodayPlus(displayUrgencyInfo.days);
    const existing = await database.collections
      .get("follow_ups")
      .query(Q.where("patient_id", patientId), Q.where("due_date", dueDate), Q.where("is_completed", false))
      .fetch();
    if (!existing.length) {
      const now = Date.now();
      await database.write(async () => {
        await database.collections.get("follow_ups").create((followUp) => {
          followUp.patientId = patientId;
          followUp.dueDate = dueDate;
          followUp.isCompleted = false;
          followUp.isOverdue = false;
          followUp.followType = displayHardFlag ? "emergency" : "risk_assessment";
          followUp.notes = `${displayRiskInfo.en}: ${clampedScore}/100`;
          followUp.isSynced = false;
          followUp.isDeleted = false;
          followUp.isMock = false;
          followUp.createdAt = now;
          followUp.updatedAt = now;
        });
      });
    }
    router.replace("/(tabs)/followups");
  }

  async function onShare() {
    const primaryCategory = CATEGORY_META[displayCategories.primary] || CATEGORY_META.general;
    const factorText = displayVisibleFactors.map((factor) => factor.en).join(", ") || "None";
    await Share.share({
      message:
        `${displayRiskInfo.en.toUpperCase()} - ${patientName}\n` +
        `Risk Score: ${clampedScore}/100 - Category: ${primaryCategory.en}\n` +
        `Key factors: ${factorText}\n` +
        `Action: ${displayRecEn || displayRecHi}\n` +
        "Sent via Shaasthi",
    });
  }

  return (
    <View style={styles.page}>
      <ShaasthiTopBar
        titleHi={displayHi("जोखिम आकलन", locale)}
        titleEn="Risk Assessment"
        showBack
        variant="surface"
        rightComponent={
          <Pressable onPress={onShare} style={styles.iconBtn} accessibilityLabel="Share assessment">
            <Ionicons name="share-outline" size={22} color={COLORS.primary} />
          </Pressable>
        }
      />

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scroll}>
        <View style={styles.patientStrip}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(patientName)}</Text>
          </View>
          <View style={styles.patientCopy}>
            <Text style={styles.patientName}>{patientName || "Loading..."}</Text>
            <Text style={styles.patientMeta}>
              {[patientAge ? `Age ${patientAge}` : null, patientGender || null].filter(Boolean).join(" · ") || "Assessment saved offline"}
            </Text>
          </View>
          <View style={[styles.statusPill, { borderColor: displaySourceInfo.color, backgroundColor: `${displaySourceInfo.color}12` }]}>
            {assessmentState === "processing" ? (
              <Animated.View style={{ opacity: pollAnim }}>
                <Ionicons name={displaySourceInfo.icon} size={12} color={displaySourceInfo.color} />
              </Animated.View>
            ) : (
              <Ionicons name={displaySourceInfo.icon} size={12} color={displaySourceInfo.color} />
            )}
            <Text style={[styles.statusPillText, { color: displaySourceInfo.color }]}>{displaySourceInfo.en}</Text>
          </View>
        </View>

        {displayHardFlag ? (
          <View style={styles.emergencyBanner}>
            <View style={styles.emergencyTop}>
              <Ionicons name="alert-circle" size={24} color="#fff" />
              <Text style={styles.emergencyTitle}>
                {locale === "bn" ? "জরুরি / EMERGENCY" : locale === "en" ? "EMERGENCY" : "आपातकाल / EMERGENCY"}
              </Text>
              <Pressable
                onPress={() => Share.share({ message: `Emergency: ${patientName}. ${displayHardFlagEn}` })}
                style={styles.callPill}
              >
                <Text style={styles.callPillText}>Call 108</Text>
              </Pressable>
            </View>
            <Text style={styles.emergencyHi}>
              {locale === "bn" ? bn(displayHardFlagHi) : locale === "en" ? displayHardFlagEn : displayHardFlagHi}
            </Text>
            {locale === "bn" ? null : <Text style={styles.emergencyBn}>{bn(displayHardFlagHi)}</Text>}
            {locale === "en" ? null : <Text style={styles.emergencyEn}>{displayHardFlagEn}</Text>}
          </View>
        ) : null}

        {assessmentState === "server_ready" || assessmentState === "ai_ready" ? (
          <View style={styles.updatedBanner}>
            <Ionicons name="cloud-download" size={14} color={COLORS.primary} />
            <Text style={styles.updatedBannerText}>
              {assessmentState === "ai_ready"
                ? indicText("AI विस्तार", locale, "AI-enhanced assessment")
                : indicText("सर्वर आकलन", locale, "Server assessment")}
            </Text>
          </View>
        ) : null}

        <View style={styles.heroCard}>
          <View style={styles.scoreBadge}>
            <Text style={[styles.scoreBadgeText, { color: displayRiskInfo.color }]}>{displayRiskInfo.en.toUpperCase()}</Text>
          </View>
          <View style={styles.gaugeWrap}>
            <Svg width={GAUGE_SIZE} height={GAUGE_SIZE}>
              <Circle cx={GAUGE_SIZE / 2} cy={GAUGE_SIZE / 2} r={GAUGE_RADIUS} stroke="#E5E7EB" strokeWidth={GAUGE_STROKE} fill="none" />
              <Circle
                cx={GAUGE_SIZE / 2}
                cy={GAUGE_SIZE / 2}
                r={GAUGE_RADIUS}
                stroke={displayRiskInfo.color}
                strokeWidth={GAUGE_STROKE}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${GAUGE_CIRCUMFERENCE} ${GAUGE_CIRCUMFERENCE}`}
                strokeDashoffset={pctOffset}
                rotation="-90"
                origin={`${GAUGE_SIZE / 2}, ${GAUGE_SIZE / 2}`}
              />
            </Svg>
            <View style={styles.gaugeText}>
              <Text style={[styles.pct, { color: displayRiskInfo.color }]}>{clampedScore}%</Text>
              <Text style={styles.levelEn}>{displayRiskInfo.en}</Text>
              <Text style={styles.levelHi}>{hiBnText(displayRiskInfo.hi, locale, displayRiskInfo.en)}</Text>
            </View>
          </View>
          <View style={styles.categoryRow}>
            {[displayCategories.primary, ...displayCategories.secondary].map((category, index) => {
              const meta = CATEGORY_META[category] || CATEGORY_META.general;
              const primary = index === 0;
              return (
                <View
                  key={`${category}-${index}`}
                  style={[styles.categoryChip, primary && { backgroundColor: displayRiskInfo.color, borderColor: displayRiskInfo.color }]}
                >
                  <Text style={[styles.categoryText, primary && styles.categoryTextPrimary]}>
                    {hiBnText(meta.hi, locale, meta.en)}
                  </Text>
                  <Text style={[styles.categoryTextEn, primary && styles.categoryTextPrimary]}>{meta.en}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Risk Factors</Text>
            <Text style={styles.sectionSub}>{indicText("जोखिम कारण", locale)}</Text>
          </View>
          {displayFactors.length > 5 ? <Text style={styles.factorCount}>{displayFactors.length} total</Text> : null}
        </View>
        <View style={styles.factorWrap}>
          {visibleFactors.length ? (
            visibleFactors.map((factor, index) => {
              const variant = factorVariant(factor);
              const v = stylesByFactor[variant];
              return (
                <View key={`${factor.key}-${index}`} style={[styles.factorChip, v.box]}>
                  <View style={[styles.factorDot, { backgroundColor: v.dot }]} />
                  <View style={styles.factorTextWrap}>
                    <Text style={[styles.factorHi, { color: v.text }]}>
                      {locale === "bn" ? bn(factor.hi) : locale === "en" ? factor.en : factor.hi}
                    </Text>
                    {locale === "bn" ? null : <Text style={[styles.factorBn, { color: v.text }]}>{bn(factor.hi)}</Text>}
                    {locale === "en" ? null : <Text style={styles.factorEn}>{factor.en}</Text>}
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.muted}>{indicText("कोई जोखिम कारण नहीं", locale)}</Text>
          )}
        </View>

        <View style={[styles.actionCard, { borderLeftColor: displayUrgencyInfo.color }]}>
          <View style={styles.actionHeader}>
            <IndicLine hi="अब क्या करें" en="What to do now" style={styles.actionTitle} />
            <View style={[styles.urgencyBadge, { backgroundColor: displayUrgencyInfo.color }]}>
              <Text style={styles.urgencyText}>
                {displayUrgencyInfo.hi} / {displayUrgencyInfo.bn}
              </Text>
            </View>
          </View>
          {assessmentState === "processing" && !displayHardFlag ? (
            <View style={{ alignItems: "center", marginVertical: 12 }}>
              <LottieWrapper name="ai_thinking" size={90} loop={true} />
              <Text style={[styles.recHi, { marginTop: 8 }]}>{displayRecHi}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.recHi}>
                {locale === "bn" ? bn(displayRecHi) : locale === "en" && displayRecEn ? displayRecEn : displayRecHi}
              </Text>
              {locale === "bn" ? null : <Text style={styles.recBn}>{bn(displayRecHi)}</Text>}
              {displayRecEn && locale !== "en" ? <Text style={styles.recEn}>{displayRecEn}</Text> : null}
            </>
          )}
          <View style={[styles.sourceBadge, { borderColor: displaySourceInfo.color, backgroundColor: `${displaySourceInfo.color}12` }]}>
            <Ionicons name={displaySourceInfo.icon} size={13} color={displaySourceInfo.color} />
            <Text style={[styles.sourceText, { color: displaySourceInfo.color }]}>
              {locale === "bn"
                ? `${displaySourceInfo.bn} · ${displaySourceInfo.en}`
                : `${displaySourceInfo.hi} / ${displaySourceInfo.bn} · ${displaySourceInfo.en}`}
            </Text>
          </View>
        </View>

        <View style={styles.checklistCard}>
          <IndicLine hi="ये कदम उठाएं" en="Complete these steps" style={styles.checklistTitle} />
          {displayChecklist.map((step, index) => {
            const isChecked = checked[index] === true;
            return (
              <Pressable key={step.hi} onPress={() => toggleStep(index)} style={styles.checkRow}>
                <Ionicons
                  name={isChecked ? "checkmark-circle" : "ellipse-outline"}
                  size={22}
                  color={isChecked ? "#138808" : COLORS.textSecondary}
                />
                <View style={styles.checkTextWrap}>
                  <Text style={[styles.checkHi, isChecked && styles.checkDone]}>
                    {locale === "bn" ? bn(step.hi) : locale === "en" ? step.en : step.hi}
                  </Text>
                  {locale === "bn" ? null : <Text style={[styles.checkBn, isChecked && styles.checkDone]}>{bn(step.hi)}</Text>}
                  {locale === "en" ? null : <Text style={[styles.checkEn, isChecked && styles.checkDone]}>{step.en}</Text>}
                </View>
              </Pressable>
            );
          })}
          {displayChecklist.every((_, index) => checked[index]) ? (
            <Text style={styles.doneText}>{indicText("सभी कदम पूरे", locale, "All steps done")}</Text>
          ) : null}
        </View>

        <View style={styles.buttonStack}>
          <GovtButton titleHi="फॉलो-अप शेड्यूल करें" titleEn="Schedule follow-up" onPress={scheduleFollowUp} />
          <GovtButton titleHi="ANM को भेजें" titleEn="Share with ANM" variant="secondary" onPress={onShare} />
          <GovtButton
            titleHi="मरीज प्रोफाइल"
            titleEn="Patient profile"
            variant="secondary"
            onPress={() => router.replace(`/(tabs)/patients/${patientId}`)}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const stylesByFactor = {
  high: {
    box: { backgroundColor: "#FEF2F2", borderColor: "#E24B4A" },
    dot: "#E24B4A",
    text: "#B91C1C",
  },
  medium: {
    box: { backgroundColor: "#FFF8EC", borderColor: "#FF9933" },
    dot: "#FF9933",
    text: "#B45309",
  },
  low: {
    box: { backgroundColor: "#F0FDF4", borderColor: "#138808" },
    dot: "#138808",
    text: "#166534",
  },
};

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  scrollContainer: { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 40 },
  iconBtn: { minWidth: tapTargetMin, minHeight: tapTargetMin, alignItems: "center", justifyContent: "center" },
  patientStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#0D1B2A", alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  patientCopy: { flex: 1 },
  patientName: { fontSize: 15, fontWeight: "900", color: "#0D1B2A" },
  patientMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusPillText: { fontSize: 9, fontWeight: "800" },
  emergencyBanner: { backgroundColor: "#E24B4A", paddingHorizontal: 20, paddingVertical: 16 },
  emergencyTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  emergencyTitle: { flex: 1, color: "#fff", fontSize: 14, fontWeight: "900", letterSpacing: 0.8 },
  callPill: { borderWidth: 1.5, borderColor: "#fff", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  callPillText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  emergencyHi: { color: "#fff", fontSize: 15, lineHeight: 23, fontWeight: "800" },
  emergencyBn: { color: "#fff", fontSize: 14, lineHeight: 22, marginTop: 3 },
  emergencyEn: { color: "rgba(255,255,255,0.84)", fontSize: 12, lineHeight: 18, marginTop: 6, fontStyle: "italic" },
  updatedBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: -8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F0F7FF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  updatedBannerText: { color: COLORS.primary, fontSize: 11, fontWeight: "800", flex: 1 },
  heroCard: { margin: 16, backgroundColor: COLORS.card, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: "#E5E7EB" },
  scoreBadge: { alignSelf: "flex-end", backgroundColor: "#F8FAFC", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  scoreBadgeText: { fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  gaugeWrap: { alignItems: "center", justifyContent: "center", marginTop: 2 },
  gaugeText: { position: "absolute", alignItems: "center" },
  pct: { fontSize: 32, fontWeight: "900" },
  levelEn: { fontSize: 12, fontWeight: "800", color: "#0D1B2A", marginTop: 2 },
  levelHi: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 16 },
  categoryChip: {
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  categoryText: { color: COLORS.textSecondary, fontSize: 11, fontWeight: "800" },
  categoryTextEn: { color: COLORS.textSecondary, fontSize: 10, marginTop: 1, textAlign: "center" },
  categoryTextPrimary: { color: "#fff" },
  sectionHeader: { paddingHorizontal: 16, marginTop: 2, marginBottom: 8, flexDirection: "row", justifyContent: "space-between" },
  sectionTitle: { color: "#0D1B2A", fontSize: 12, fontWeight: "900", letterSpacing: 0.8, textTransform: "uppercase" },
  sectionSub: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  factorCount: { color: COLORS.primary, fontSize: 12, fontWeight: "800" },
  factorWrap: { paddingHorizontal: 16, gap: 8, marginBottom: 10 },
  factorChip: {
    minHeight: 50,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  factorDot: { width: 8, height: 8, borderRadius: 4 },
  factorTextWrap: { flex: 1 },
  factorHi: { fontSize: 13, fontWeight: "900" },
  factorBn: { fontSize: 12, fontWeight: "700", marginTop: 1 },
  factorEn: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  muted: { color: COLORS.textSecondary, marginBottom: 8 },
  actionCard: {
    margin: 16,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderLeftWidth: 5,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  actionHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  actionTitle: { color: "#0D1B2A", fontSize: 15, fontWeight: "900" },
  bengaliLine: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  englishLine: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  urgencyBadge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  urgencyText: { color: "#fff", fontSize: 10, fontWeight: "900" },
  recHi: { color: "#0D1B2A", fontSize: 16, lineHeight: 25, fontWeight: "800" },
  recBn: { color: "#0D1B2A", fontSize: 15, lineHeight: 24, marginTop: 7 },
  recEn: { color: COLORS.textSecondary, fontSize: 13, lineHeight: 20, fontStyle: "italic", marginTop: 8 },
  sourceBadge: {
    marginTop: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sourceText: { fontSize: 10, fontWeight: "800" },
  checklistCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  checklistTitle: { color: "#0D1B2A", fontSize: 14, fontWeight: "900" },
  checkRow: { minHeight: 48, flexDirection: "row", alignItems: "flex-start", gap: 10, paddingTop: 12 },
  checkTextWrap: { flex: 1 },
  checkHi: { color: "#0D1B2A", fontSize: 13, fontWeight: "800" },
  checkBn: { color: COLORS.textPrimary, fontSize: 12, marginTop: 1 },
  checkEn: { color: COLORS.textSecondary, fontSize: 11, marginTop: 1 },
  checkDone: { textDecorationLine: "line-through", color: "#138808" },
  doneText: { marginTop: 10, color: "#138808", fontWeight: "900", fontSize: 12 },
  buttonStack: { marginHorizontal: 16, gap: 12 },
});
