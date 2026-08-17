import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { COLORS } from "../constants/colors";
import { TricolorStripe } from "./TricolorStripe";
import { tapTargetMin } from "../constants/typography";
import { localizePair, translateHindiText, useLocale } from "../utils/localization";

export function NativeBuildRequired() {
  const router = useRouter();
  const locale = useLocale();
  const pair = (hi, en) => localizePair(hi, en, locale);

  return (
    <View style={styles.page}>
      <TricolorStripe />
      <SafeAreaView style={styles.safe}>
        <Text style={styles.titleHi}>
          {locale === "en" ? "Development build required" : translateHindiText("डेवलपमेंट बिल्ड आवश्यक", locale)}
        </Text>
        {locale === "en" ? null : <Text style={styles.titleEn}>Development build required</Text>}
        <Text style={styles.body}>SHAASTHI uses offline SQLite (WatermelonDB). Expo Go does not include the native database module.</Text>
        <Text style={styles.bodyHi}>{translateHindiText("एक बार नेटिव ऐप बनाएँ, फिर Metro से खोलें:", locale)}</Text>
        <View style={styles.codeBox}>
          <Text style={styles.code}>cd shaasthi-app</Text>
          <Text style={styles.code}>npm run native:android</Text>
          <Text style={styles.codeHint}>{translateHindiText("या", locale)} iOS: npm run native:ios</Text>
          <Text style={styles.code}>npm run start:dev</Text>
          <Text style={styles.codeHint}>Metro error on emulator? npm run android:reload</Text>
        </View>
        <Pressable style={styles.btn} onPress={() => router.replace("/(auth)/login")}>
          <Text style={styles.btnTxt}>{pair("लॉगिन स्क्रीन", "Back to login")}</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  safe: { flex: 1, padding: 24, justifyContent: "center", gap: 12 },
  titleHi: { fontSize: 20, fontWeight: "900", color: COLORS.primary },
  titleEn: { fontSize: 13, color: COLORS.textSecondary },
  body: { fontSize: 14, color: COLORS.textPrimary, lineHeight: 22, marginTop: 8 },
  bodyHi: { fontSize: 14, fontWeight: "700", color: COLORS.textPrimary },
  codeBox: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  code: { fontFamily: "Menlo", fontSize: 13, color: COLORS.primary },
  codeHint: { fontSize: 12, color: COLORS.textSecondary },
  btn: {
    marginTop: 16,
    minHeight: tapTargetMin,
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  btnTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
