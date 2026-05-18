import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDispatch } from "react-redux";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";
import { apiClient } from "../../api/client";
import { endpoints } from "../../constants/api";
import { COLORS } from "../../constants/colors";
import {
  verifyOtp,
  setTokens,
  setUser,
  setWorkerData,
  setOfflinePilotSession,
} from "../../features/auth/authSlice";
import { persistAuthSession } from "../../store/AppProvider";
import { initAutoSync } from "../../database/sync";
import { store } from "../../store/store";

const MOCK_WORKER = {
  serverId: "local-asha-worker",
  name: "ASHA Pilot",
  village: "गोपालपुर",
  block: "Pilot Block",
  workerCode: "WB-ASHA-001",
};

export default function OtpScreen() {
  const params = useLocalSearchParams();
  const phone = params.phone || "9000000000";
  const devOtp = params.devOtp ? String(params.devOtp) : "";
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [timer, setTimer] = useState(45);
  const [canResend, setCanResend] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const refs = [useRef(), useRef(), useRef(), useRef(), useRef(), useRef()];
  const router = useRouter();
  const dispatch = useDispatch();

  useEffect(() => {
    if (timer <= 0) {
      setCanResend(true);
      return undefined;
    }
    const t = setInterval(() => setTimer((x) => x - 1), 1000);
    return () => clearInterval(t);
  }, [timer]);

  async function handleVerify() {
    const otpString = otp.join("");
    if (otpString.length !== 6) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiClient.post(endpoints.verifyOtp, {
        phone: `+91${phone}`,
        otp: otpString,
      });
      const { access, refresh, user, worker } = res.data;
      if (access) await SecureStore.setItemAsync("accessToken", access);
      if (refresh) await SecureStore.setItemAsync("refreshToken", refresh);
      dispatch(setTokens({ access, refresh }));
      dispatch(setUser(user));
      dispatch(setWorkerData(worker || MOCK_WORKER));
      dispatch(setOfflinePilotSession(false));
      await persistAuthSession(user, worker || MOCK_WORKER);
    } catch {
      dispatch(setOfflinePilotSession(true));
      dispatch(
        verifyOtp({
          user: { id: `phone-${phone}`, name: "Pilot ASHA", phone: `+91${phone}` },
          worker: MOCK_WORKER,
        })
      );
    } finally {
      setLoading(false);
    }
    const { user: u2, workerData: w2, accessToken } = store.getState().auth;
    await persistAuthSession(u2, w2 || MOCK_WORKER);
    if (accessToken) initAutoSync();
    router.replace("/(tabs)/home");
  }

  function onDigit(i, text) {
    const digit = text.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[i] = digit;
    setOtp(next);
    if (digit && i < 5) refs[i + 1].current?.focus?.();
  }

  function onKeyPress(i, e) {
    if (e.nativeEvent.key === "Backspace" && !otp[i] && i > 0) {
      refs[i - 1].current?.focus?.();
    }
  }

  function handleResend() {
    setTimer(45);
    setCanResend(false);
    setOtp(["", "", "", "", "", ""]);
    refs[0].current?.focus?.();
  }

  const last4 = String(phone).slice(-4);

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.top}>
        <SafeAreaView style={styles.topInner}>
          <Text style={styles.logo}>MEDILIFT</Text>
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
          <Pressable
            style={styles.devHint}
            onPress={() => setOtp(devOtp.split("").slice(0, 6))}
          >
            <Text style={styles.devHintTxt}>Dev OTP: {devOtp} (tap to fill)</Text>
          </Pressable>
        ) : null}
        <View style={styles.boxRow}>
          {otp.map((d, i) => (
            <TextInput
              key={i}
              ref={refs[i]}
              style={[styles.box, d ? styles.boxFilled : null]}
              keyboardType="number-pad"
              maxLength={1}
              value={d}
              onChangeText={(t) => onDigit(i, t)}
              onKeyPress={(e) => onKeyPress(i, e)}
            />
          ))}
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {canResend ? (
          <Pressable onPress={handleResend}>
            <Text style={styles.resendActive}>फिर से भेजें / Resend OTP</Text>
          </Pressable>
        ) : (
          <Text style={styles.resend}>
            OTP फिर से भेजें / Resend in 0:{String(timer).padStart(2, "0")}
          </Text>
        )}
        <Pressable
          style={[styles.verify, otp.some((x) => x === "") || loading ? styles.verifyDisabled : null]}
          disabled={otp.some((x) => x === "") || loading}
          onPress={handleVerify}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.verifyText}>सत्यापित करें / Verify</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  top: { flex: 0.22, backgroundColor: COLORS.primary },
  topInner: { flex: 1, alignItems: "center", justifyContent: "center" },
  logo: { color: "#fff", fontSize: 22, fontWeight: "800" },
  card: {
    flex: 0.78,
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -12,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  back: { position: "absolute", top: 16, left: 16, zIndex: 2, padding: 8 },
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
  boxRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 28 },
  box: {
    width: 44,
    height: 52,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.textPrimary,
    paddingTop: 10,
  },
  boxFilled: { borderColor: COLORS.primary },
  error: { color: COLORS.danger, marginTop: 8 },
  resend: { textAlign: "center", color: COLORS.textHint, marginTop: 20, fontSize: 13 },
  resendActive: { textAlign: "center", color: COLORS.accent, marginTop: 20, fontSize: 13, fontWeight: "800" },
  verify: {
    marginTop: 28,
    minHeight: 52,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  verifyDisabled: { backgroundColor: COLORS.textHint, opacity: 0.5 },
  verifyText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
