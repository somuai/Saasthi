import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../../api/client";
import { endpoints } from "../../constants/api";
import { COLORS } from "../../constants/colors";
import { OtpInputRow } from "../../components/OtpInputRow";
import { TricolorStripe } from "../../components/TricolorStripe";
import {
  verifyOtp,
  setTokens,
  setUser,
  setWorkerData,
  setOfflinePilotSession,
} from "../../features/auth/authSlice";
import {
  isInvalidOtpError,
  clearPendingLogin,
  persistAuthSession,
  persistAuthTokens,
  readPendingLogin,
  shouldFallbackToOfflinePilot,
} from "../../features/auth/authSession";
import { isWatermelonNativeAvailable } from "../../database/isNativeAvailable";
import { setStoredLocale } from "../../utils/locale";
import { tapTargetMin } from "../../constants/typography";

const MOCK_WORKER = {
  serverId: "local-asha-worker",
  name: "ASHA Pilot",
  village: "गोपालपुर",
  block: "Pilot Block",
  workerCode: "WB-ASHA-001",
};

function buildPilotUser(phone, locale) {
  return {
    id: `phone-${phone}`,
    name: "Pilot ASHA",
    phone: `+91${phone}`,
    language: locale,
  };
}

export default function OtpScreen() {
  const params = useLocalSearchParams();
  const [phone, setPhone] = useState(params.phone ? String(params.phone) : "");
  const [devOtp, setDevOtp] = useState(params.devOtp ? String(params.devOtp) : "");
  const [locale, setLocaleState] = useState(params.locale ? String(params.locale) : "hi");
  const [otp, setOtp] = useState("");
  const [timer, setTimer] = useState(45);
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const dispatch = useDispatch();

  useEffect(() => {
    if (params.phone && params.locale) return;
    readPendingLogin().then(({ phone: p, locale: l }) => {
      if (!params.phone && p) setPhone(p);
      if (!params.locale && l) setLocaleState(l);
    });
  }, [params.phone, params.locale]);

  useEffect(() => {
    if (locale) setStoredLocale(locale);
  }, [locale]);

  useEffect(() => {
    if (timer <= 0) {
      setCanResend(true);
      return undefined;
    }
    const t = setInterval(() => setTimer((x) => x - 1), 1000);
    return () => clearInterval(t);
  }, [timer]);

  async function completeLogin(sessionUser, worker, accessToken) {
    await persistAuthSession(sessionUser, worker);
    await clearPendingLogin();
    if (accessToken && isWatermelonNativeAvailable()) {
      const { initAutoSync } = await import("../../database/sync");
      initAutoSync();
    }
    if (isWatermelonNativeAvailable()) {
      router.replace("/(tabs)/home");
    } else {
      router.replace("/(auth)/native-required");
    }
  }

  async function handleVerify(otpString) {
    const code = otpString || otp;
    if (phone.length !== 10) {
      setError("मोबाइल नंबर गायब — लॉगिन पर वापस जाएँ / Missing phone — return to login");
      return;
    }
    if (code.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.post(endpoints.verifyOtp, {
        phone: `+91${phone}`,
        otp: code,
      });
      const { access, refresh, user, worker } = res.data;
      await persistAuthTokens({ access, refresh });
      dispatch(setTokens({ access, refresh }));
      const sessionUser = { ...user, language: locale };
      const sessionWorker = worker || MOCK_WORKER;
      dispatch(setUser(sessionUser));
      dispatch(setWorkerData(sessionWorker));
      dispatch(setOfflinePilotSession(false));
      await completeLogin(sessionUser, sessionWorker, access);
    } catch (err) {
      if (isInvalidOtpError(err)) {
        setError("गलत या समाप्त OTP / Invalid or expired OTP");
        return;
      }
      if (!shouldFallbackToOfflinePilot(err)) {
        setError("सर्वर त्रुटि — बाद में प्रयास करें / Server error, try again");
        return;
      }
      const sessionUser = buildPilotUser(phone, locale);
      dispatch(setOfflinePilotSession(true));
      dispatch(verifyOtp({ user: sessionUser, worker: MOCK_WORKER }));
      await completeLogin(sessionUser, MOCK_WORKER, null);
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (phone.length !== 10) {
      setError("मोबाइल नंबर गायब — लॉगिन पर वापस जाएँ / Missing phone — return to login");
      return;
    }
    setResending(true);
    setError("");
    try {
      const res = await apiClient.post(endpoints.requestOtp, { phone: `+91${phone}` });
      const nextDevOtp = res.data?.dev_otp ? String(res.data.dev_otp) : "";
      if (nextDevOtp) setDevOtp(nextDevOtp);
    } catch (err) {
      if (!shouldFallbackToOfflinePilot(err)) {
        setError("OTP नहीं भेजा जा सका — बाद में प्रयास करें / Could not resend OTP");
        setResending(false);
        return;
      }
      /* offline — allow resend UI reset without new SMS */
    }
    setTimer(45);
    setCanResend(false);
    setOtp("");
    setResending(false);
  }

  const last4 = String(phone).slice(-4);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.top}>
        <TricolorStripe />
        <SafeAreaView style={styles.topInner}>
          <Text style={styles.logo}>SHAASTHI</Text>
        </SafeAreaView>
      </View>
      <View style={styles.card}>
        <Pressable style={styles.back} onPress={() => router.back()} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </Pressable>
        <Text style={styles.titleHi}>OTP सत्यापन</Text>
        <Text style={styles.titleEn}>OTP Verification</Text>
        <Text style={styles.info}>
          आपके +91 XXXXXX{last4} पर OTP भेजा गया है{"\n"}
          OTP sent to +91 …{last4}
        </Text>
        {devOtp ? (
          <Pressable style={styles.devHint} onPress={() => setOtp(devOtp.slice(0, 6))}>
            <Text style={styles.devHintTxt}>Dev OTP: {devOtp} (tap to fill)</Text>
          </Pressable>
        ) : null}
        <OtpInputRow
          value={otp}
          onChange={setOtp}
          onComplete={handleVerify}
          autoFocus
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {canResend ? (
          <Pressable onPress={handleResend} disabled={resending} style={styles.resendBtn}>
            {resending ? (
              <ActivityIndicator color={COLORS.accent} />
            ) : (
              <Text style={styles.resendActive}>फिर से भेजें / Resend OTP</Text>
            )}
          </Pressable>
        ) : (
          <Text style={styles.resend}>
            OTP फिर से भेजें / Resend in 0:{String(timer).padStart(2, "0")}
          </Text>
        )}
        <Pressable
          style={[styles.verify, otp.length < 6 || loading ? styles.verifyDisabled : null]}
          disabled={otp.length < 6 || loading}
          onPress={() => handleVerify()}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.verifyText}>सत्यापित करें / Verify</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  top: { flex: 0.2, backgroundColor: COLORS.primary },
  topInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  logo: { color: "#fff", fontSize: 22, fontWeight: "800" },
  card: {
    flex: 0.8,
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -12,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  back: { position: "absolute", top: 16, left: 16, zIndex: 2, padding: 8, minHeight: tapTargetMin, minWidth: tapTargetMin },
  titleHi: { fontSize: 20, fontWeight: "800", color: COLORS.textPrimary },
  titleEn: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  info: { fontSize: 13, color: COLORS.textSecondary, marginTop: 20, lineHeight: 20 },
  devHint: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#E8F5E9",
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  devHintTxt: { fontSize: 12, fontWeight: "700", color: COLORS.success, textAlign: "center" },
  error: { color: COLORS.danger, marginTop: 8 },
  resend: { textAlign: "center", color: COLORS.textHint, marginTop: 20, fontSize: 13 },
  resendActive: { textAlign: "center", color: COLORS.accent, fontSize: 13, fontWeight: "800" },
  resendBtn: { marginTop: 20, minHeight: tapTargetMin, justifyContent: "center" },
  verify: {
    marginTop: 28,
    minHeight: tapTargetMin,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  verifyDisabled: { backgroundColor: COLORS.textHint, opacity: 0.5 },
  verifyText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
