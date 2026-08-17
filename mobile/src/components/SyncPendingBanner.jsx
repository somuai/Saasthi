import PropTypes from "prop-types";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSelector } from "react-redux";
import { COLORS } from "../constants/colors";
import { localizePair, translateHindiText, useLocale } from "../utils/localization";

export function SyncPendingBanner({ onSyncPress }) {
  const router = useRouter();
  const pendingCount = useSelector((s) => s.sync.pendingCount);
  const isSyncing = useSelector((s) => s.sync.isSyncing);
  const locale = useLocale();

  if (pendingCount <= 0) return null;

  function handleSync() {
    if (onSyncPress) onSyncPress();
    else router.push("/(tabs)/sync");
  }

  return (
    <Pressable style={styles.banner} onPress={handleSync} accessibilityRole="button">
      <View style={styles.left}>
        <Ionicons name="cloud-upload-outline" size={24} color={COLORS.syncBannerIcon} />
        <View style={styles.textCol}>
          <Text style={styles.title}>
            {localizePair(`${pendingCount} सर्वेक्षण सिंक के लिए लंबित`, `${pendingCount} pending sync`, locale)}
          </Text>
          <Text style={styles.sub}>{translateHindiText("ऑफलाइन डेटा सर्वर पर भेजें", locale)}</Text>
        </View>
      </View>
      <Text style={styles.cta}>{isSyncing ? "…" : "SYNC"}</Text>
    </Pressable>
  );
}

SyncPendingBanner.propTypes = {
  onSyncPress: PropTypes.func,
};

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.syncBannerBg,
    borderWidth: 1,
    borderColor: COLORS.syncBannerBorder,
    borderRadius: 12,
    padding: 14,
    minHeight: 52,
  },
  left: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  textCol: { flex: 1 },
  title: { fontSize: 13, fontWeight: "700", color: COLORS.textPrimary },
  sub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  cta: { fontSize: 12, fontWeight: "800", color: COLORS.primary },
});
