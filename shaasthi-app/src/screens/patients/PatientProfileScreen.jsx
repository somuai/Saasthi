import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDatabase } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import { Ionicons } from "@expo/vector-icons";
import { GovtHeader } from "../../components/GovtHeader";
import { GovtButton } from "../../components/GovtButton";
import { RiskBadge } from "../../components/RiskBadge";
import { COLORS } from "../../constants/colors";
import { RISK_LEVEL_COLORS } from "../../ml/riskConstants";
import { tapTargetMin } from "../../constants/typography";
import AsyncStorage from "@react-native-async-storage/async-storage";

const VISIT_LABELS = {
  first: { hi: "पहली बार", en: "First" },
  followup: { hi: "फॉलो-अप", en: "Follow-up" },
  emergency: { hi: "आपात", en: "Emergency" },
};

export default function PatientProfileScreen() {
  const { id } = useLocalSearchParams();
  const database = useDatabase();
  const router = useRouter();
  const [patient, setPatient] = useState(null);
  const [surveys, setSurveys] = useState([]);

  useEffect(() => {
    if (!id) return undefined;
    const query = database.collections.get("patients").query(Q.where("id", id));
    const sub = query.observe().subscribe((recs) => setPatient(recs[0] || null));
    return () => sub.unsubscribe();
  }, [database, id]);

  useEffect(() => {
    if (!id) return undefined;
    const sub = database.collections
      .get("survey_responses")
      .query(Q.where("patient_id", id), Q.where("is_deleted", false), Q.sortBy("created_at", Q.desc))
      .observe()
      .subscribe(setSurveys);
    return () => sub.unsubscribe();
  }, [database, id]);

  const deleteSurvey = useCallback(
    async (survey) => {
      Alert.alert(
        "Delete survey",
        `Delete ${survey.surveyDate || "this"} survey for ${patient?.name}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              await database.write(async () => {
                await survey.markAsDeleted();
              });
            },
          },
        ],
      );
    },
    [database, patient],
  );

  const continueSurvey = useCallback(
    async (survey) => {
      if (survey.isComplete) return;
      const key = `survey_draft_${survey.patientId}`;
      try {
        const existing = await AsyncStorage.getItem(key);
        if (!existing) {
          await AsyncStorage.setItem(key, JSON.stringify({}));
        }
      } catch {}
      router.push(`/(tabs)/survey/${survey.patientId}`);
    },
    [router],
  );

  if (!patient) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: "center" }}>
        <Text style={{ textAlign: "center" }}>Loading…</Text>
      </View>
    );
  }

  const risk = {
    riskLevel: patient.riskLevel,
    score: patient.riskScore,
    riskLevelHi: patient.riskLevel,
    riskColor: RISK_LEVEL_COLORS[patient.riskLevel] || COLORS.textHint,
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <GovtHeader titleHi="मरीज प्रोफाइल" title="Patient profile" showBack showSync />
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scroll}>
        <Text style={styles.name}>{patient.name}</Text>
        <RiskBadge risk={risk} />
        <GovtButton
          titleHi="सर्वे शुरू करें"
          titleEn="Start survey"
          onPress={() => router.push(`/(tabs)/survey/${patient.id}`)}
        />
        <View style={{ height: 12 }} />
        <GovtButton
          titleHi="भेंट रिकॉर्ड"
          titleEn="Record visit"
          variant="secondary"
          onPress={() => router.push(`/(tabs)/patients/visit/${patient.id}`)}
        />
        {patient.isPregnant ? (
          <Pressable style={styles.link} onPress={() => router.push(`/(tabs)/mcp/anc?patientId=${patient.id}`)}>
            <Text style={styles.linkTxt}>ANC register →</Text>
          </Pressable>
        ) : null}
        {patient.dateOfBirth ? (
          <>
            <Pressable style={styles.link} onPress={() => router.push(`/(tabs)/mcp/immunization?patientId=${patient.id}`)}>
              <Text style={styles.linkTxt}>Immunization →</Text>
            </Pressable>
            <Pressable style={styles.link} onPress={() => router.push(`/(tabs)/mcp/growth?patientId=${patient.id}`)}>
              <Text style={styles.linkTxt}>Growth monitoring →</Text>
            </Pressable>
          </>
        ) : null}

        {surveys.length > 0 ? (
          <>
            <Text style={styles.sectionHi}>सर्वे इतिहास</Text>
            <Text style={styles.sectionEn}>Survey history</Text>
            {surveys.map((s) => {
              const vl = VISIT_LABELS[s.visitType] || { hi: s.visitType, en: s.visitType };
              const riskColor = RISK_LEVEL_COLORS[s.computedRiskLevel] || COLORS.textHint;
              return (
                <View key={s.id} style={styles.historyCard}>
                  <View style={styles.historyLeft}>
                    <View style={[styles.riskDot, { backgroundColor: riskColor }]} />
                    <View style={styles.historyInfo}>
                      <Text style={styles.historyDate}>{s.surveyDate || "—"}</Text>
                      <Text style={styles.historyMeta}>
                        {vl.hi} · {s.computedRiskLevel || "—"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.historyActions}>
                    {!s.isComplete ? (
                      <Pressable
                        style={styles.actionBtn}
                        onPress={() => continueSurvey(s)}
                        accessibilityLabel="Continue survey"
                      >
                        <Ionicons name="play" size={16} color={COLORS.accent} />
                        <Text style={styles.actionText}>Continue</Text>
                      </Pressable>
                    ) : null}
                    <Pressable
                      style={[styles.actionBtn, styles.deleteBtn]}
                      onPress={() => deleteSurvey(s)}
                      accessibilityLabel="Delete survey"
                    >
                      <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                      <Text style={[styles.actionText, { color: COLORS.danger }]}>Delete</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </>
        ) : (
          <>
            <Text style={styles.sectionHi}>सर्वे इतिहास</Text>
            <Text style={styles.sectionEn}>Survey history</Text>
            <Text style={styles.muted}>कोई सर्वे नहीं / No surveys yet</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flex: 1 },
  scroll: { padding: 16, gap: 12, flexGrow: 1 },
  name: { fontSize: 20, fontWeight: "800", color: COLORS.textPrimary },
  link: { minHeight: tapTargetMin, justifyContent: "center" },
  linkTxt: { color: COLORS.accent, fontWeight: "700", fontSize: 15 },
});
