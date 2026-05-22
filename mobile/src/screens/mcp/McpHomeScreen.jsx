import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ListRow } from "../../components/ListRow";
import { GovtHeader } from "../../components/GovtHeader";
import { COLORS } from "../../constants/colors";

export default function McpHomeScreen() {
  const router = useRouter();
  return (
    <View style={styles.page}>
      <GovtHeader titleHi="एमसीपी" title="MCP tools" showSync />
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>MCP tools / एमसीपी उपकरण</Text>
        <ListRow title="Register / पंजीकरण" subtitle="Register pregnant woman or child for MCP tracking" meta="Open" onPress={() => router.push("/(tabs)/mcp/register")} />
        <ListRow title="Pregnancy Dashboard / गर्भावस्था डैशबोर्ड" subtitle="POG, EDD, ANC status, risk flags at a glance" meta="Open" onPress={() => router.push("/(tabs)/mcp/dashboard")} />
        <ListRow title="ANC planner / एएनसी योजना" subtitle="Gestational age, EDD, visit due status" meta="Open" onPress={() => router.push("/(tabs)/mcp/anc")} />
        <ListRow title="PNC / प्रसवोत्तर" subtitle="Day 1, 3, 7 and week 6 visits" meta="Open" onPress={() => router.push("/(tabs)/mcp/pnc")} />
        <ListRow title="Immunization / टीकाकरण" subtitle="Due and overdue vaccine helper" meta="Open" onPress={() => router.push("/(tabs)/mcp/immunization")} />
        <ListRow title="Growth / वृद्धि" subtitle="BMI and child growth helper" meta="Open" onPress={() => router.push("/(tabs)/mcp/growth")} />
        <ListRow title="Child development / बाल विकास" subtitle="Milestone checklist and referral" meta="Open" onPress={() => router.push("/(tabs)/mcp/child-dev")} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  scrollContainer: { flex: 1 },
  scroll: { padding: 16, gap: 8, flexGrow: 1 },
  title: { fontSize: 16, fontWeight: "800", color: COLORS.textPrimary, marginBottom: 8 },
});
