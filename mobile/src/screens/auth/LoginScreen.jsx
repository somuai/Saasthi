import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../../api/client";
import { endpoints } from "../../constants/api";
import { COLORS } from "../../constants/colors";
import { BilingualLabel } from "../../components/BilingualLabel";
import { TricolorStripe } from "../../components/TricolorStripe";
import { requestOtp, setOfflinePilotSession, setTokens, setUser, setWorkerData } from "../../features/auth/authSlice";
import { clearPendingLogin, persistAuthSession, persistAuthTokens, persistPendingLogin } from "../../features/auth/authSession";
import { isWatermelonNativeAvailable } from "../../database/isNativeAvailable";
import { LOCALES, getStoredLocale, setStoredLocale } from "../../utils/locale";
import { localizePair, translateHindiText } from "../../utils/localization";
import { logger } from "../../utils/logger";
import { tapTargetMin } from "../../constants/typography";
import { setConfirmationResult, clearConfirmationResult } from "../../utils/firebaseConfirm";
import { tryFirebasePnvVerification } from "../../services/phoneNumberVerification";

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [locale, setLocale] = useState("hi");
  const router = useRouter();
  const dispatch = useDispatch();
  const pair = (hi, en) => localizePair(hi, en, locale);
  const hiText = (hi) => (locale === "en" ? hi : translateHindiText(hi, locale));

  useEffect(() => {
    getStoredLocale().then(setLocale);
  }, []);

  async function pickLocale(id) {
    const next = await setStoredLocale(id);
    setLocale(next);
  }

  async function completeServerLogin(payload) {
    const { access, refresh, user, worker } = payload;
    await persistAuthTokens({ access, refresh });
    dispatch(setTokens({ access, refresh }));
    const sessionUser = { ...user, language: locale };
    dispatch(setUser(sessionUser));
    dispatch(setWorkerData(worker));
    dispatch(setOfflinePilotSession(false));
    await persistAuthSession(sessionUser, worker);
    await clearPendingLogin();
    import("../../services/fcm").then(({ registerFcmTokenOnServer }) => registerFcmTokenOnServer());
    if (access && isWatermelonNativeAvailable()) {
      const { initAutoSync } = await import("../../database/sync");
      initAutoSync();
    }
    router.replace(isWatermelonNativeAvailable() ? "/(tabs)/home" : "/(auth)/native-required");
  }

  async function handleSendOTP() {
    if (phone.length !== 10) {
      setError(pair("कृपया 10 अंक का नंबर दर्ज करें", "Enter 10-digit number"));
      return;
    }
    setLoading(true);
    setError("");
    clearConfirmationResult();
    let devOtp = "";
    let useFirebase = false;
    /* Try Android Firebase Phone Number Verification first, then Firebase SMS. */
    try {
      const pnvResult = await tryFirebasePnvVerification();
      if (pnvResult.status === "verified") {
        const res = await apiClient.post(endpoints.firebasePnvVerify, {
          pnv_token: pnvResult.token,
          phone: pnvResult.phoneNumber,
        });
        await completeServerLogin(res.data);
        return;
      }
      if (pnvResult.status !== "disabled") {
        logger.debug("Firebase PNV skipped", pnvResult.status);
      }

      const auth = (await import("@react-native-firebase/auth")).default;
      const cr = await auth().signInWithPhoneNumber(`+91${phone}`);
      setConfirmationResult(cr);
      useFirebase = true;
    } catch (fbErr) {
      logger.warn("Firebase phone verification failed, trying legacy OTP fallback", fbErr?.code || fbErr?.message);
      /* Firebase not available (no google-services.json, emulator, etc.) — fall back to legacy OTP */
      try {
        const res = await apiClient.post(endpoints.requestOtp, { phone: `+91${phone}` });
        devOtp = res.data?.debug_otp || "";
      } catch (apiErr) {
        logger.error("Legacy OTP fallback failed", apiErr?.message);
        /* offline / no API — pilot continues */
      }
    } finally {
      setLoading(false);
    }
    await persistPendingLogin({ phone, locale });
    dispatch(requestOtp(phone));
    router.push({ pathname: "/(auth)/otp", params: { phone, devOtp, locale, useFirebase: useFirebase ? "1" : "0" } });
  }

  async function pilotLogin() {
    const pilotPhone = "9000000000";
    await persistPendingLogin({ phone: pilotPhone, locale });
    dispatch(requestOtp(pilotPhone));
    router.push({ pathname: "/(auth)/otp", params: { phone: pilotPhone, locale } });
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.top}>
        <TricolorStripe />
        <SafeAreaView style={styles.topInner}>
          <Image source={require("../../../assets/shaasthi-logo.png")} style={styles.logoImg} resizeMode="contain" />
          <Text style={styles.logo}>SHAASTHI</Text>
          <Text style={styles.logoHi}>{hiText("सास्थी")}</Text>
          <Text style={styles.sub}>ASHA Healthcare Platform</Text>
          <Text style={styles.nhm}>{pair("राष्ट्रीय स्वास्थ्य मिशन", "National Health Mission")}</Text>
        </SafeAreaView>
      </View>
      <View style={styles.card}>
        <ScrollView
          style={styles.scrollContainer}
          contentContainerStyle={styles.cardInner}
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator
        >
          <Text style={styles.signHi}>{locale === "en" ? "Sign In" : hiText("साइन इन करें")}</Text>
          {locale === "en" ? null : <Text style={styles.signEn}>Sign In — mobile OTP</Text>}
          <View style={styles.langRow}>
            {LOCALES.map((l) => (
              <Pressable
                key={l.id}
                onPress={() => pickLocale(l.id)}
                style={[styles.langChip, locale === l.id && styles.langChipOn]}
                accessibilityLabel={l.full}
              >
                <Text style={[styles.langTxt, locale === l.id && styles.langTxtOn]}>{l.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ height: 16 }} />
          <BilingualLabel labelHi="मोबाइल नंबर" labelEn="Mobile Number" required />
          <View style={[styles.phoneRow, error && { borderColor: COLORS.danger }]}>
            <View style={styles.prefixBox}>
              <Text style={styles.prefixText}>+91</Text>
            </View>
            <TextInput
              accessibilityLabel="Mobile number"
              style={styles.phoneInput}
              keyboardType="number-pad"
              maxLength={10}
              placeholder="XXXXXXXXXX"
              value={phone}
              onChangeText={(t) => setPhone(t.replace(/\D/g, ""))}
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={{ height: 20 }} />
          <Pressable
            accessibilityRole="button"
            onPress={handleSendOTP}
            disabled={loading || phone.length < 10}
            style={({ pressed }) => [
              styles.cta,
              (phone.length < 10 || loading) && { opacity: 0.5 },
              pressed && { transform: [{ scale: 0.98 }] },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.ctaRow}>
                <View>
                  <Text style={styles.ctaHi}>{locale === "en" ? "Send OTP" : hiText("OTP भेजें")}</Text>
                  {locale === "en" ? null : <Text style={styles.ctaEn}>Send OTP</Text>}
                </View>
                <Ionicons name="arrow-forward" size={22} color="#fff" />
              </View>
            )}
          </Pressable>
          {process.env.EXPO_PUBLIC_ENV !== "production" && (
            <>
              <View style={{ height: 20 }} />
              <View style={styles.orRow}>
                <View style={styles.line} />
                <Text style={styles.or}>{pair("या", "OR")}</Text>
                <View style={styles.line} />
              </View>
              <View style={{ height: 16 }} />
              <Pressable style={styles.outlineBtn} onPress={pilotLogin}>
                <Text style={styles.outlineText}>{pair("पायलट", "Pilot login (no server)")}</Text>
              </Pressable>
            </>
          )}
          <Text style={styles.aadhaarHint}>{pair("आधार OTP — जल्द उपलब्ध", "Aadhaar OTP — coming soon")}</Text>
          <View style={{ flex: 1, minHeight: 16 }} />
          <View style={styles.footer}>
            <Ionicons name="lock-closed-outline" size={14} color={COLORS.textHint} />
            <Text style={styles.footerText}>{pair("NIC द्वारा सुरक्षित", "Secured by NIC")}</Text>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  scrollContainer: { flex: 1 },
  top: { flex: 0.3, minHeight: 220, backgroundColor: COLORS.primary },
  topInner: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingBottom: 16 },
  logoImg: { width: 72, height: 72, marginTop: 16 },
  logo: { color: "#fff", fontSize: 32, fontWeight: "800", letterSpacing: 3, marginTop: 8 },
  logoHi: { color: "#fff", fontSize: 16, marginTop: 4 },
  sub: { color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 8 },
  nhm: { color: "rgba(255,255,255,0.55)", fontSize: 10, marginTop: 8, textAlign: "center" },
  card: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -12,
  },
  cardInner: { paddingHorizontal: 28, paddingTop: 28, paddingBottom: Platform.OS === "ios" ? 88 : 40, flexGrow: 1 },
  signHi: { fontSize: 22, fontWeight: "800", color: COLORS.textPrimary },
  signEn: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  langRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  langChip: {
    minWidth: 44,
    minHeight: tapTargetMin,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  langChipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  langTxt: { fontWeight: "700", color: COLORS.textPrimary },
  langTxtOn: { color: "#fff" },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: tapTargetMin,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    overflow: "hidden",
  },
  prefixBox: {
    width: 52,
    minHeight: tapTargetMin,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  prefixText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  phoneInput: { flex: 1, paddingHorizontal: 12, fontSize: 18, letterSpacing: 2, color: COLORS.textPrimary },
  error: { color: COLORS.danger, fontSize: 12, marginTop: 8 },
  cta: {
    minHeight: tapTargetMin,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  ctaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" },
  ctaHi: { color: "#fff", fontSize: 16, fontWeight: "800" },
  ctaEn: { color: "rgba(255,255,255,0.85)", fontSize: 11 },
  orRow: { flexDirection: "row", alignItems: "center" },
  line: { flex: 1, height: 1, backgroundColor: COLORS.border },
  or: { paddingHorizontal: 12, color: COLORS.textHint, fontSize: 12 },
  outlineBtn: {
    minHeight: tapTargetMin,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineText: { color: COLORS.primary, fontSize: 14, fontWeight: "700" },
  aadhaarHint: { textAlign: "center", fontSize: 11, color: COLORS.textHint, marginTop: 12 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  footerText: { color: COLORS.textHint, fontSize: 11 },
});
