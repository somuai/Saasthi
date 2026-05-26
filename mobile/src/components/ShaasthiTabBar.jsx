import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { McpIcon } from "./McpIcon";

const DEFAULT_TAB_META = {
  home: { icon: "home", hi: "होम", en: "Home" },
  patients: { icon: "people", hi: "मरीज", en: "Records" },
  followups: { icon: "calendar", hi: "फॉलो-अप", en: "Tracker" },
  earnings: { icon: "wallet", hi: "कमाई", en: "Ledger" },
  mcp: { icon: "medkit", customIcon: McpIcon, hi: "एमसीपी", en: "MCP" },
  map: { icon: "map", hi: "नक्शा", en: "Map" },
  "ai-assistant": { icon: "chatbubbles", hi: "AI", en: "AI" },
};

export function ShaasthiTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (keyboardVisible) return null;

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={styles.bar}>
        {state.routes
          .filter((r) => r.name in DEFAULT_TAB_META)
          .map((route) => {
            const { options } = descriptors[route.key];
            const meta = DEFAULT_TAB_META[route.name] || { icon: "ellipse", hi: route.name, en: route.name };
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
                  {meta.customIcon ? (
                    <meta.customIcon size={22} color={focused ? COLORS.primary : COLORS.textSecondary} />
                  ) : (
                    <Ionicons
                      name={focused ? meta.icon : `${meta.icon}-outline`}
                      size={22}
                      color={focused ? COLORS.primary : COLORS.textSecondary}
                    />
                  )}
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
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  bar: {
    flexDirection: "row",
    minHeight: 62,
    paddingTop: 6,
    paddingHorizontal: 8,
    gap: 4,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 5,
    borderRadius: 14,
    minHeight: 50,
  },
  tabActive: {
    backgroundColor: COLORS.navyLight,
  },
  labelHi: { fontSize: 10, fontWeight: "800", color: COLORS.textSecondary, marginTop: 2, lineHeight: 13 },
  labelEn: { fontSize: 8, color: COLORS.textHint, lineHeight: 11 },
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
