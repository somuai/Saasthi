import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { MediliftTabBar } from "../../src/components/MediliftTabBar";
import { useOverdueFollowUpCount } from "../../src/hooks/useOverdueFollowUpCount";

export default function TabsLayout() {
  const overdueCount = useOverdueFollowUpCount();

  return (
    <Tabs
      tabBar={(props) => <MediliftTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: "none" },
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
