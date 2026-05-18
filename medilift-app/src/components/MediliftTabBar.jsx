import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";

const TAB_META = {
  home: { icon: "home", hi: "होम", en: "Home" },
  patients: { icon: "people", hi: "मरीज", en: "Records" },
  followups: { icon: "calendar", hi: "फॉलो-अप", en: "Tracker" },
  earnings: { icon: "wallet", hi: "कमाई", en: "Ledger" },
  mcp: { icon: "medkit", hi: "एमसीपी", en: "MCP" },
};

export function MediliftTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.bar}>
        {state.routes
          .filter((r) => ["home", "patients", "followups", "earnings", "mcp"].includes(r.name))
          .map((route) => {
            const { options } = descriptors[route.key];
            const meta = TAB_META[route.name] || { icon: "ellipse", hi: route.name, en: route.name };
            const focused = state.routes[state.index]?.key === route.key;
            const badge = options.tabBarBadge;

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                onPress={() => {
                  const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
                }}
                style={[styles.tab, focused && styles.tabActive]}
              >
                <View>
                  <Ionicons
                    name={focused ? meta.icon : `${meta.icon}-outline`}
                    size={22}
                    color={focused ? COLORS.primary : COLORS.textSecondary}
                  />
                  {badge ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeTxt}>{badge}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.labelHi, focused && styles.labelActive]}>{meta.hi}</Text>
                <Text style={[styles.labelEn, focused && styles.labelActive]}>{meta.en}</Text>
              </Pressable>
            );
          })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.surfaceContainer,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  bar: {
    flexDirection: "row",
    minHeight: 64,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    borderRadius: 999,
    minHeight: 52,
  },
  tabActive: {
    backgroundColor: COLORS.navyLight,
  },
  labelHi: { fontSize: 10, fontWeight: "800", color: COLORS.textSecondary, marginTop: 2 },
  labelEn: { fontSize: 8, color: COLORS.textHint },
  labelActive: { color: COLORS.primary },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: COLORS.danger,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTxt: { color: "#fff", fontSize: 9, fontWeight: "800" },
});
