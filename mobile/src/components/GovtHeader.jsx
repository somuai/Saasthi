import PropTypes from "prop-types";
import { Image, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { TricolorStripe } from "./TricolorStripe";
import { OfflineBanner } from "./OfflineBanner";
import { PilotSyncBanner } from "./PilotSyncBanner";
import { SyncIndicator } from "./SyncIndicator";
import { translateHindiText, useLocale } from "../utils/localization";

export function GovtHeader({ title, titleEn, titleHi, showBack, showSync, rightComponent, backgroundColor }) {
  const router = useRouter();
  const rawInsets = useSafeAreaInsets();
  // Guard against a missing SafeAreaProvider ancestor (returns all-zero insets on iOS,
  // causing content to slide under the notch/Dynamic Island).
  const insets = { top: rawInsets?.top || 0, bottom: rawInsets?.bottom || 0 };
  const locale = useLocale();
  const englishTitle = titleEn ?? title;
  const hi = titleHi ?? title;
  const showBrandText = !hi;
  const primaryTitle = locale === "en" ? englishTitle || titleHi : translateHindiText(hi, locale);
  const showSubTitle = locale !== "en" && titleHi && englishTitle && englishTitle !== titleHi;
  const bg = backgroundColor ?? COLORS.primary;
  return (
    <View style={[styles.wrap, { backgroundColor: bg }]}>
      <TricolorStripe />
      <StatusBar barStyle="light-content" backgroundColor={bg} />
      <View style={[styles.bar, { paddingTop: Math.max(insets.top, 8), backgroundColor: bg }]}>
        <View style={[styles.left, showBack && styles.leftCompact]}>
          {showBack ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => router.back()} style={styles.iconBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
          ) : null}
          <View style={styles.brandRow}>
            <Image source={require("../../assets/shaasthi-logo.png")} style={styles.brandLogo} resizeMode="contain" />
            {showBrandText ? (
              <Text style={styles.brand} numberOfLines={1}>
                SHAASTHI
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.center}>
          <Text style={styles.title} numberOfLines={1}>
            {primaryTitle}
          </Text>
          {showSubTitle ? (
            <Text style={styles.sub} numberOfLines={1}>
              {englishTitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.right}>
          {showSync ? <SyncIndicator /> : null}
          {rightComponent}
        </View>
      </View>
      <PilotSyncBanner />
      <OfflineBanner />
    </View>
  );
}

GovtHeader.propTypes = {
  title: PropTypes.string,
  titleEn: PropTypes.string,
  titleHi: PropTypes.string,
  showBack: PropTypes.bool,
  showSync: PropTypes.bool,
  rightComponent: PropTypes.node,
};

const styles = StyleSheet.create({
  wrap: { backgroundColor: COLORS.primary },
  bar: {
    minHeight: 72,
    paddingHorizontal: 12,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.primary,
  },
  left: { flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 },
  leftCompact: { flex: 0.72 },
  iconBtn: {
    minWidth: 52,
    minHeight: 52,
    marginRight: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 },
  brandLogo: { width: 28, height: 28 },
  brand: { color: "#fff", fontSize: 11, fontWeight: "800", letterSpacing: 0.5, flexShrink: 1 },
  center: { flex: 2.2, alignItems: "center", minWidth: 0, paddingHorizontal: 8 },
  title: { color: "#fff", fontSize: 16, fontWeight: "800", textAlign: "center" },
  sub: { color: "rgba(255,255,255,0.85)", fontSize: 11 },
  right: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
});
