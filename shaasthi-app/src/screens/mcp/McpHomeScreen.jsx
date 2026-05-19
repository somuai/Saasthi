import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ListRow } from "../../components/ListRow";
import { GovtHeader } from "../../components/GovtHeader";
import { COLORS } from "../../constants/colors";

export default function McpHomeScreen() {
  const router = useRouter();
  return (
    <View style={styles.page}>
      <GovtHeader titleHi="एमसीपी" title="MCP tools" showSync />
      <View style={styles.body}>
        <Text style={styles.title}>MCP tools / एमसीपी उपकरण</Text>
        <ListRow title="ANC planner / एएनसी योजना" subtitle="Gestational age, EDD, visit due status" meta="Open" onPress={() => router.push("/(tabs)/mcp/anc")} />
        <ListRow title="PNC / प्रसवोत्तर" subtitle="Day 1, 3, 7 and week 6 visits" meta="Open" onPress={() => router.push("/(tabs)/mcp/pnc")} />
        <ListRow title="Immunization / टीकाकरण" subtitle="Due and overdue vaccine helper" meta="Open" onPress={() => router.push("/(tabs)/mcp/immunization")} />
        <ListRow title="Growth / वृद्धि" subtitle="BMI and child growth helper" meta="Open" onPress={() => router.push("/(tabs)/mcp/growth")} />
        <ListRow title="Child development / बाल विकास" subtitle="Milestone checklist and referral" meta="Open" onPress={() => router.push("/(tabs)/mcp/child-dev")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  body: { padding: 16, gap: 8 },
  title: { fontSize: 16, fontWeight: "800", color: COLORS.textPrimary, marginBottom: 8 },
});
