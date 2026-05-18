import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDatabase } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import { GovtHeader } from "../../components/GovtHeader";
import { GovtButton } from "../../components/GovtButton";
import { RiskBadge } from "../../components/RiskBadge";
import { COLORS } from "../../constants/colors";
import { RISK_LEVEL_COLORS } from "../../ml/riskConstants";
import { tapTargetMin } from "../../constants/typography";

export default function PatientProfileScreen() {
  const { id } = useLocalSearchParams();
  const database = useDatabase();
  const router = useRouter();
  const [patient, setPatient] = useState(null);

  useEffect(() => {
    if (!id) return undefined;
    const query = database.collections.get("patients").query(Q.where("id", id));
    const sub = query.observe().subscribe((recs) => setPatient(recs[0] || null));
    return () => sub.unsubscribe();
  }, [database, id]);

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
      <View style={styles.body}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 12 },
  name: { fontSize: 20, fontWeight: "800", color: COLORS.textPrimary },
  link: { minHeight: tapTargetMin, justifyContent: "center" },
  linkTxt: { color: COLORS.accent, fontWeight: "700", fontSize: 15 },
});
