import { StyleSheet, Text, View } from "react-native";
import { useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { STRINGS } from "../constants/strings";

/** Shown when logged in without API tokens — local-only pilot; sync will fail until server OTP. */
export function PilotSyncBanner() {
  const isOfflinePilot = useSelector((s) => s.auth.isOfflinePilotSession);
  if (!isOfflinePilot) return null;

  return (
    <View style={styles.bar}>
      <Ionicons name="warning-outline" size={16} color="#fff" />
      <View style={styles.textWrap}>
        <Text style={styles.hi}>{STRINGS.OFFLINE_PILOT_SYNC.hi}</Text>
        <Text style={styles.en}>{STRINGS.OFFLINE_PILOT_SYNC.en}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 52,
    backgroundColor: COLORS.danger,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  textWrap: { flex: 1, gap: 2 },
  hi: { color: "#fff", fontSize: 14, fontWeight: "700" },
  en: { color: "rgba(255,255,255,0.9)", fontSize: 11 },
});
