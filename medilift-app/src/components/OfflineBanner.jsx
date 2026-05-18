import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSelector } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { STRINGS } from "../constants/strings";

export function OfflineBanner() {
  const isOnline = useSelector((s) => s.sync.isOnline);
  const slide = useRef(new Animated.Value(-40)).current;

  useEffect(() => {
    if (!isOnline) {
      Animated.spring(slide, { toValue: 0, useNativeDriver: true }).start();
    } else {
      Animated.timing(slide, { toValue: -40, duration: 200, useNativeDriver: true }).start();
    }
  }, [isOnline, slide]);

  if (isOnline) return null;

  return (
    <Animated.View style={[styles.bar, { transform: [{ translateY: slide }] }]}>
      <Ionicons name="cloud-offline-outline" size={14} color="#fff" />
      <Text style={styles.text}>
        {STRINGS.OFFLINE_MODE.hi} / {STRINGS.OFFLINE_MODE.en}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 32,
    backgroundColor: COLORS.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  text: { color: "#fff", fontSize: 12, fontWeight: "600" },
});
