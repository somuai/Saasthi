import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../src/constants/colors";
import { useOverdueFollowUpCount } from "../../src/hooks/useOverdueFollowUpCount";

export default function TabsLayout() {
  const overdueCount = useOverdueFollowUpCount();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          minHeight: 64,
          paddingBottom: 8,
          paddingTop: 8,
          backgroundColor: COLORS.primary,
          borderTopWidth: 0,
        },
        tabBarActiveTintColor: "#fff",
        tabBarInactiveTintColor: "rgba(255,255,255,0.55)",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700" },
        tabBarItemStyle: { paddingTop: 4 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarLabel: "होम / Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="patients"
        options={{
          title: "Patients",
          tabBarLabel: "मरीज / Patients",
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="followups"
        options={{
          title: "Follow-ups",
          tabBarLabel: "फॉलो-अप / Follow-ups",
          tabBarBadge: overdueCount > 0 ? overdueCount : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: "Earnings",
          tabBarLabel: "कमाई / Earnings",
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="mcp"
        options={{
          title: "MCP",
          tabBarLabel: "एमसीपी / MCP",
          tabBarIcon: ({ color, size }) => <Ionicons name="medkit" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen name="survey" options={{ href: null }} />
    </Tabs>
  );
}
