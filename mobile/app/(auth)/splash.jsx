import { useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import { COLORS } from "../../src/constants/colors";
import { TricolorStripe } from "../../src/components/TricolorStripe";
import { AUTH_USER_KEY } from "../../src/features/auth/authSession";
import { isWatermelonNativeAvailable } from "../../src/database/isNativeAvailable";

function AshokaLion({ size = 96 }) {
  return (
    <Svg width={size * 0.75} height={size} viewBox="0 0 24 28">
      <Path
        fill="#fff"
        d="M12 2c-1.5 2-4 3-6 4 1 2 1 4 0 6 2 1 4 1 6 0-1-2-1-4 0-6 2-1 4.5-2 6-4zm-6 10c-2 2-3 5-2 8h4c-1-3 0-6 2-8h-4zm12 0c2 2 3 5 2 8h-4c1-3 0-6-2-8h4zM8 22c0 3 2 5 4 6 2-1 4-3 4-6h-8z"
      />
    </Svg>
  );
}

export default function AuthSplashScreen() {
  const router = useRouter();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setProgress((p) => Math.min(100, p + 12));
    }, 180);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (progress < 100) return undefined;
    const nav = setTimeout(async () => {
      try {
        const storedUser = await AsyncStorage.getItem(AUTH_USER_KEY);
        if (storedUser && isWatermelonNativeAvailable()) {
          router.replace("/(tabs)/home");
        } else if (storedUser) {
          router.replace("/(auth)/native-required");
        } else {
          router.replace("/(auth)/login");
        }
      } catch (e) {
        if (__DEV__) console.warn("[Splash] navigation error:", e);
        router.replace("/(auth)/login");
      }
    }, 400);
    return () => clearTimeout(nav);
  }, [progress, router]);

  return (
    <View style={styles.page}>
      <TricolorStripe />
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Image source={require("../../assets/shaasthi-logo.png")} style={styles.logoImg} resizeMode="contain" />
          <Text style={styles.title}>SHAASTHI</Text>
          <Text style={styles.titleHi}>सास्थी — ASHA संगिनी</Text>
          <Text style={styles.nhm}>राष्ट्रीय स्वास्थ्य मिशन | National Health Mission</Text>
        </View>
        <View style={styles.footer}>
          <View style={styles.brandRow}>
            <View style={styles.abdmBadge}>
              <Text style={styles.abdmTxt}>ABDM</Text>
            </View>
            <Text style={styles.abdmSub}>Ayushman Bharat Digital Mission</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress}%` }]} />
          </View>
          <ActivityIndicator color="#fff" style={{ marginTop: 16 }} />
          <Text style={styles.loading}>डेटाबेस तैयार हो रहा है… / Preparing offline data</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.primary },
  safe: { flex: 1, justifyContent: "space-between", paddingHorizontal: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  logoImg: { width: 96, height: 96 },
  title: { color: "#fff", fontSize: 28, fontWeight: "900", letterSpacing: 4, marginTop: 20 },
  titleHi: { color: "rgba(255,255,255,0.9)", fontSize: 14, marginTop: 8 },
  nhm: { color: "rgba(255,255,255,0.55)", fontSize: 11, marginTop: 12, textAlign: "center" },
  footer: { paddingBottom: 32, width: "100%" },
  brandRow: { alignItems: "center", marginBottom: 20 },
  abdmBadge: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  abdmTxt: { color: "#fff", fontWeight: "900", letterSpacing: 2 },
  abdmSub: { color: "rgba(255,255,255,0.6)", fontSize: 10, marginTop: 6 },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.15)",
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: COLORS.accent, borderRadius: 3 },
  loading: { color: "rgba(255,255,255,0.7)", fontSize: 12, textAlign: "center", marginTop: 8 },
});
