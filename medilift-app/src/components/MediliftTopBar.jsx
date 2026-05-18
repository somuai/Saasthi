import PropTypes from "prop-types";
import { Pressable, StatusBar, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { TricolorStripe } from "./TricolorStripe";
import { tapTargetMin } from "../constants/typography";

export function MediliftTopBar({
  titleHi,
  titleEn,
  showBack,
  rightComponent,
  variant = "primary",
}) {
  const router = useRouter();
  const dark = variant === "primary";

  return (
    <View style={[styles.wrap, dark && styles.wrapPrimary]}>
      <TricolorStripe />
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} backgroundColor={dark ? COLORS.primary : COLORS.card} />
      <View style={[styles.bar, dark && styles.barPrimary]}>
        <View style={styles.side}>
          {showBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => router.back()}
              style={styles.iconBtn}
            >
              <Ionicons name="arrow-back" size={24} color={dark ? "#fff" : COLORS.primary} />
            </Pressable>
          ) : (
            <View style={styles.iconBtn} />
          )}
        </View>
        <View style={styles.center}>
          <Text style={[styles.titleHi, dark && styles.titleLight]}>{titleHi}</Text>
          {titleEn ? <Text style={[styles.titleEn, dark && styles.titleEnLight]}>{titleEn}</Text> : null}
        </View>
        <View style={[styles.side, styles.sideRight]}>{rightComponent}</View>
      </View>
    </View>
  );
}

MediliftTopBar.propTypes = {
  titleHi: PropTypes.string.isRequired,
  titleEn: PropTypes.string,
  showBack: PropTypes.bool,
  rightComponent: PropTypes.node,
  variant: PropTypes.oneOf(["primary", "surface"]),
};

const styles = StyleSheet.create({
  wrap: { backgroundColor: COLORS.card },
  wrapPrimary: { backgroundColor: COLORS.primary },
  bar: {
    minHeight: tapTargetMin + 8,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  barPrimary: { backgroundColor: COLORS.primary },
  side: { width: 52, alignItems: "flex-start" },
  sideRight: { alignItems: "flex-end" },
  iconBtn: {
    minWidth: tapTargetMin,
    minHeight: tapTargetMin,
    alignItems: "center",
    justifyContent: "center",
  },
  center: { flex: 1, alignItems: "center" },
  titleHi: { fontSize: 16, fontWeight: "800", color: COLORS.textPrimary },
  titleEn: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  titleLight: { color: "#fff" },
  titleEnLight: { color: "rgba(255,255,255,0.85)" },
});
