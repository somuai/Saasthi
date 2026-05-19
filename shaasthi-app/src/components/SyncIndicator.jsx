import { useEffect, useRef } from "react";
import PropTypes from "prop-types";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";

export function SyncIndicator({ compact }) {
  const router = useRouter();
  const { isSyncing, pendingCount, lastSyncedAt, isOnline } = useSelector((s) => s.sync);
  const spin = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isSyncing) {
      const loop = Animated.loop(
        Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true })
      );
      loop.start();
      return () => loop.stop();
    }
    spin.setValue(0);
    return undefined;
  }, [isSyncing, spin]);

  useEffect(() => {
    if (!isOnline || pendingCount <= 0) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.35, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isOnline, pendingCount, pulse]);

  const rotation = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  let dotColor = COLORS.synced;
  let labelHi = "सिंक";
  let labelEn = "Synced";
  if (!isOnline) {
    dotColor = COLORS.offline;
    labelHi = "ऑफलाइन";
    labelEn = "Offline";
  } else if (isSyncing) {
    dotColor = COLORS.pending;
    labelHi = "सिंक...";
    labelEn = "Syncing";
  } else if (pendingCount > 0) {
    dotColor = COLORS.pending;
    labelHi = `${pendingCount} बाकी`;
    labelEn = `${pendingCount} pending`;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open sync status"
      onPress={() => router.push("/(tabs)/sync")}
      style={styles.row}
    >
      {isSyncing ? (
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Ionicons name="refresh" size={compact ? 16 : 18} color={COLORS.accent} />
        </Animated.View>
      ) : (
        <Animated.View style={{ transform: [{ scale: pendingCount > 0 && isOnline ? pulse : 1 }] }}>
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
        </Animated.View>
      )}
      {!compact && (
        <View>
          <Text style={styles.hi}>{labelHi}</Text>
          <Text style={styles.en}>{labelEn}</Text>
        </View>
      )}
    </Pressable>
  );
}

SyncIndicator.propTypes = {
  compact: PropTypes.bool,
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  hi: { color: "#fff", fontSize: 11, fontWeight: "700" },
  en: { color: "rgba(255,255,255,0.85)", fontSize: 9 },
});
