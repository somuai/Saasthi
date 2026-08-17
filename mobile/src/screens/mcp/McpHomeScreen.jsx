import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ListRow } from "../../components/ListRow";
import { GovtHeader } from "../../components/GovtHeader";
import { COLORS } from "../../constants/colors";
import { localizePair, useLocale } from "../../utils/localization";

export default function McpHomeScreen() {
  const router = useRouter();
  const locale = useLocale();
  const pair = (hi, en) => localizePair(hi, en, locale);

  return (
    <View style={styles.page}>
      <GovtHeader titleHi="एमसीपी" title="MCP tools" showSync />
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{pair("एमसीपी उपकरण", "MCP tools")}</Text>
        <ListRow
          title={pair("पंजीकरण", "Register")}
          subtitle="Register pregnant woman or child for MCP tracking"
          meta="Open"
          onPress={() => router.push("/(tabs)/mcp/register")}
        />
        <ListRow
          title={pair("गर्भावस्था डैशबोर्ड", "Pregnancy Dashboard")}
          subtitle="POG, EDD, ANC status, risk flags at a glance"
          meta="Open"
          onPress={() => router.push("/(tabs)/mcp/dashboard")}
        />
        <ListRow
          title={pair("एएनसी योजना", "ANC planner")}
          subtitle="Gestational age, EDD, visit due status"
          meta="Open"
          onPress={() => router.push("/(tabs)/mcp/anc")}
        />
        <ListRow
          title={pair("प्रसवोत्तर", "PNC")}
          subtitle="Day 1, 3, 7 and week 6 visits"
          meta="Open"
          onPress={() => router.push("/(tabs)/mcp/pnc")}
        />
        <ListRow
          title={pair("टीकाकरण", "Immunization")}
          subtitle="Due and overdue vaccine helper"
          meta="Open"
          onPress={() => router.push("/(tabs)/mcp/immunization")}
        />
        <ListRow
          title={pair("वृद्धि", "Growth")}
          subtitle="BMI and child growth helper"
          meta="Open"
          onPress={() => router.push("/(tabs)/mcp/growth")}
        />
        <ListRow
          title={pair("बाल विकास", "Child development")}
          subtitle="Milestone checklist and referral"
          meta="Open"
          onPress={() => router.push("/(tabs)/mcp/child-dev")}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  scrollContainer: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 110, gap: 8, flexGrow: 1 },
  title: { fontSize: 16, fontWeight: "800", color: COLORS.textPrimary, marginBottom: 8 },
});
