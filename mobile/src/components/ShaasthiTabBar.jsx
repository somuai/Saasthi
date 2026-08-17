import { Animated, Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { usePathname } from "expo-router";
import { COLORS } from "../constants/colors";
import { TAB_BAR_BOTTOM_GAP, TAB_BAR_HORIZONTAL_MARGIN } from "../constants/layout";
import { McpIcon } from "./McpIcon";
import { translateHindiText, useLocale } from "../utils/localization";

const DEFAULT_TAB_META = {
  home: { icon: "home", hi: "होम", en: "Home" },
  patients: { icon: "people", hi: "रिकॉर्ड", en: "Records" },
  earnings: { icon: "wallet", hi: "कमाई", en: "Ledger" },
  mcp: { icon: "medkit", customIcon: McpIcon, hi: "माँ कंट्रोल", en: "Mother Control" },
  map: { icon: "map", hi: "नक्शा", en: "Map" },
};

export function ShaasthiTabBar({ state, descriptors, navigation }) {
  const rawInsets = useSafeAreaInsets();
  // Guard against a missing SafeAreaProvider ancestor (returns all-zero insets on iOS,
  // causing the floating tab bar to render behind the home indicator).
  const insets = { top: rawInsets?.top || 0, bottom: rawInsets?.bottom || 0 };
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const locale = useLocale();

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const visibleRoutes = state.routes
    .filter((r) => {
      if (!(r.name in DEFAULT_TAB_META)) return false;
      const { options } = descriptors[r.key];
      if (options.href === null || options.tabBarButton) return false;
      return true;
    })
    .sort((a, b) => {
      const order = ["home", "patients", "mcp", "map", "earnings"];
      return order.indexOf(a.name) - order.indexOf(b.name);
    });

  const activeRouteName = state.routes[state.index]?.name;
  const activeVisibleIndex = visibleRoutes.findIndex((r) => r.name === activeRouteName);

  const [containerWidth, setContainerWidth] = useState(0);
  const [translateX] = useState(() => new Animated.Value(0));
  const [pillScaleX] = useState(() => new Animated.Value(1));

  // Initialize individual spring scale values for each tab to animate icons on focus
  const [tabScales] = useState(() => {
    const scales = {};
    Object.keys(DEFAULT_TAB_META).forEach((key) => {
      scales[key] = new Animated.Value(1);
    });
    return scales;
  });

  const numTabs = visibleRoutes.length;
  // Tab Bar container paddingHorizontal is 8 on each side, so usable width is containerWidth - 16
  const tabWidth = numTabs > 0 ? (containerWidth - 16) / numTabs : 0;

  useEffect(() => {
    if (activeVisibleIndex >= 0 && tabWidth > 0) {
      // Offset of 8 for left container padding, plus centering the pill (4px offset for tabWidth - 8 pill width)
      const targetX = 8 + activeVisibleIndex * tabWidth + 4;

      Animated.parallel([
        Animated.spring(translateX, {
          toValue: targetX,
          useNativeDriver: true,
          bounciness: 6,
          speed: 14,
        }),
        Animated.sequence([
          Animated.spring(pillScaleX, {
            toValue: 1.25, // stretch pill horizontally as it starts moving
            useNativeDriver: true,
            bounciness: 4,
            speed: 20,
          }),
          Animated.spring(pillScaleX, {
            toValue: 1.0, // squash back to normal size at destination
            useNativeDriver: true,
            bounciness: 6,
            speed: 12,
          }),
        ]),
      ]).start();
    }
  }, [activeVisibleIndex, tabWidth]);

  useEffect(() => {
    // Animate individual tab scales: focused tab springs up, others scale down slightly
    visibleRoutes.forEach((route) => {
      const isFocused = state.routes[state.index]?.key === route.key;
      const scaleVal = tabScales[route.name];
      if (scaleVal) {
        Animated.spring(scaleVal, {
          toValue: isFocused ? 1.12 : 0.94,
          useNativeDriver: true,
          bounciness: 10,
          speed: 14,
        }).start();
      }
    });
  }, [state.index, visibleRoutes]);

  const pathname = usePathname();
  const isDeep = pathname.split("/").filter(Boolean).length > 1;

  if (keyboardVisible || isDeep) return null;

  return (
    <View style={[styles.wrap, { marginBottom: Math.max(insets.bottom, TAB_BAR_BOTTOM_GAP) }]}>
      <View
        style={styles.bar}
        onLayout={(e) => {
          const { width } = e.nativeEvent.layout;
          setContainerWidth(width);
        }}
      >
        {containerWidth > 0 && tabWidth > 0 && (
          <Animated.View
            style={[
              styles.liquidPill,
              {
                width: tabWidth - 8,
                transform: [{ translateX }, { scaleX: pillScaleX }],
              },
            ]}
          />
        )}

        {visibleRoutes.map((route) => {
          const { options } = descriptors[route.key];
          const meta = DEFAULT_TAB_META[route.name] || { icon: "ellipse", hi: route.name, en: route.name };
          const focused = state.routes[state.index]?.key === route.key;
          const badge = options.tabBarBadge;
          const primaryLabel = locale === "en" ? meta.en : translateHindiText(meta.hi, locale);
          const scaleVal = tabScales[route.name] || new Animated.Value(1);

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              onPress={() => {
                const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={styles.tab}
            >
              <Animated.View style={{ transform: [{ scale: scaleVal }], alignItems: "center" }}>
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
                <Text style={[styles.labelHi, focused && styles.labelActive]}>{primaryLabel}</Text>
                {locale === "en" ? null : <Text style={[styles.labelEn, focused && styles.labelActive]}>{meta.en}</Text>}
              </Animated.View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: TAB_BAR_HORIZONTAL_MARGIN,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  bar: {
    flexDirection: "row",
    minHeight: 66,
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 8,
    gap: 4,
    alignItems: "center",
  },
  liquidPill: {
    position: "absolute",
    top: 6,
    bottom: 6,
    borderRadius: 16,
    backgroundColor: "rgba(65, 108, 175, 0.12)", // Liquid gel-pill tint (primary color with opacity)
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 5,
    minHeight: 50,
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
