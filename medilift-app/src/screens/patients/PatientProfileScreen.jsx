import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDatabase } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import { GovtHeader } from "../../components/GovtHeader";
import { RiskBadge } from "../../components/RiskBadge";
import { COLORS } from "../../constants/colors";
import { RISK_LEVEL_COLORS } from "../../ml/riskConstants";

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
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: "800", color: COLORS.textPrimary }}>{patient.name}</Text>
        <RiskBadge risk={risk} />
        <Text style={{ color: COLORS.textSecondary }} onPress={() => router.push(`/(tabs)/survey/${patient.id}`)}>
          सर्वे शुरू / Start survey →
        </Text>
        {patient.isPregnant ? (
          <Text style={{ color: COLORS.accent, fontWeight: "700" }} onPress={() => router.push(`/(tabs)/mcp/anc?patientId=${patient.id}`)}>
            ANC register →
          </Text>
        ) : null}
        {patient.dateOfBirth ? (
          <>
            <Text style={{ color: COLORS.accent, fontWeight: "700" }} onPress={() => router.push(`/(tabs)/mcp/immunization?patientId=${patient.id}`)}>
              Immunization →
            </Text>
            <Text style={{ color: COLORS.accent, fontWeight: "700" }} onPress={() => router.push(`/(tabs)/mcp/growth?patientId=${patient.id}`)}>
              Growth monitoring →
            </Text>
          </>
        ) : null}
      </View>
    </View>
  );
}
