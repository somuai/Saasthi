import { Text } from "react-native";
import { useRouter } from "expo-router";
import { ListRow } from "../../components/ListRow";
import { Screen } from "../../components/Screen";
import { typography } from "../../constants/design";

export default function McpHomeScreen() {
  const router = useRouter();
  return (
    <Screen>
      <Text style={typography.title}>MCP tools / एमसीपी उपकरण</Text>
      <ListRow title="ANC planner / एएनसी योजना" subtitle="Gestational age, EDD, visit due status" meta="Open" onPress={() => router.push("/(tabs)/mcp/anc")} />
      <ListRow title="Immunization / टीकाकरण" subtitle="Due and overdue vaccine helper" meta="Open" onPress={() => router.push("/(tabs)/mcp/immunization")} />
      <ListRow title="Growth / वृद्धि" subtitle="BMI and child growth helper" meta="Open" onPress={() => router.push("/(tabs)/mcp/growth")} />
    </Screen>
  );
}
