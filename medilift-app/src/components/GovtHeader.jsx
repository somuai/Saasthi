import PropTypes from "prop-types";
import { Image, Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { TricolorStripe } from "./TricolorStripe";
import { OfflineBanner } from "./OfflineBanner";
import { PilotSyncBanner } from "./PilotSyncBanner";
import { SyncIndicator } from "./SyncIndicator";

function AshokaLion({ size = 22 }) {
  return (
    <Svg width={18} height={size} viewBox="0 0 24 28">
      <Path
        fill="#fff"
        d="M12 2c-1.5 2-4 3-6 4 1 2 1 4 0 6 2 1 4 1 6 0-1-2-1-4 0-6 2-1 4.5-2 6-4zm-6 10c-2 2-3 5-2 8h4c-1-3 0-6 2-8h-4zm12 0c2 2 3 5 2 8h-4c1-3 0-6-2-8h4zM8 22c0 3 2 5 4 6 2-1 4-3 4-6h-8z"
      />
    </Svg>
  );
}

export function GovtHeader({
  title,
  titleHi,
  showBack,
  showSync,
  rightComponent,
}) {
  const router = useRouter();
  const hi = titleHi ?? title;
  return (
    <View style={styles.wrap}>
      <TricolorStripe />
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <View style={styles.bar}>
        <View style={styles.left}>
          {showBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              style={styles.iconBtn}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </Pressable>
          ) : null}
          <View style={styles.brandRow}>
            <Image source={require("../../assets/saasthi-logo.png")} style={styles.brandLogo} resizeMode="contain" />
            <Text style={styles.brand}>SAASTHI</Text>
          </View>
        </View>
        <View style={styles.center}>
          <Text style={styles.title}>{hi}</Text>
          {titleHi && title && title !== titleHi ? <Text style={styles.sub}>{title}</Text> : null}
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
  titleHi: PropTypes.string,
  showBack: PropTypes.bool,
  showSync: PropTypes.bool,
  rightComponent: PropTypes.node,
};

const styles = StyleSheet.create({
  wrap: { backgroundColor: COLORS.primary },
  bar: {
    minHeight: 64,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.primary,
  },
  left: { flexDirection: "row", alignItems: "center", flex: 1 },
  iconBtn: {
    minWidth: 52,
    minHeight: 52,
    marginRight: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  brandLogo: { width: 22, height: 22 },
  brand: { color: "#fff", fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  center: { flex: 2, alignItems: "center" },
  title: { color: "#fff", fontSize: 16, fontWeight: "700" },
  sub: { color: "rgba(255,255,255,0.85)", fontSize: 11 },
  right: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 },
});
