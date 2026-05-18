import { useState } from "react";
import {
  ActivityIndicator,
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
import { requestOtp } from "../../features/auth/authSlice";

export default function LoginScreen() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const dispatch = useDispatch();

  async function handleSendOTP() {
    if (phone.length !== 10) {
      setError("कृपया 10 अंक का नंबर दर्ज करें / Enter 10-digit number");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await apiClient.post(endpoints.requestOtp, { phone: `+91${phone}` });
    } catch {
      /* offline / no API — pilot continues */
    } finally {
      setLoading(false);
    }
    dispatch(requestOtp(phone));
    router.push({ pathname: "/(auth)/otp", params: { phone } });
  }

  function pilotLogin() {
    dispatch(requestOtp("9000000000"));
    router.push({ pathname: "/(auth)/otp", params: { phone: "9000000000" } });
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.top}>
        <SafeAreaView style={styles.topInner}>
          <Ionicons name="shield-checkmark" size={64} color="#fff" style={{ marginTop: 24 }} />
          <Text style={styles.logo}>MEDILIFT</Text>
          <Text style={styles.logoHi}>मेडिलिफ्ट</Text>
          <Text style={styles.sub}>ASHA Healthcare Platform</Text>
          <Text style={styles.nhm}>राष्ट्रीय स्वास्थ्य मिशन | National Health Mission</Text>
        </SafeAreaView>
      </View>
      <View style={styles.card}>
        <ScrollView contentContainerStyle={styles.cardInner} keyboardShouldPersistTaps="handled">
          <Text style={styles.signHi}>साइन इन करें</Text>
          <Text style={styles.signEn}>Sign In</Text>
          <View style={{ height: 24 }} />
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
          <View style={{ height: 24 }} />
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
                  <Text style={styles.ctaHi}>OTP भेजें</Text>
                  <Text style={styles.ctaEn}>Send OTP</Text>
                </View>
                <Ionicons name="arrow-forward" size={22} color="#fff" />
              </View>
            )}
          </Pressable>
          <View style={{ height: 20 }} />
          <View style={styles.orRow}>
            <View style={styles.line} />
            <Text style={styles.or}>या / OR</Text>
            <View style={styles.line} />
          </View>
          <View style={{ height: 16 }} />
          <Pressable style={styles.outlineBtn} onPress={pilotLogin}>
            <Text style={styles.outlineText}>Pilot login (no server) / पायलट</Text>
          </Pressable>
          <View style={{ flex: 1, minHeight: 24 }} />
          <View style={styles.footer}>
            <Ionicons name="lock-closed-outline" size={14} color={COLORS.textHint} />
            <Text style={styles.footerText}>NIC द्वारा सुरक्षित | Secured by NIC</Text>
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  top: { flex: 0.38, backgroundColor: COLORS.primary },
  topInner: { flex: 1, alignItems: "center", paddingHorizontal: 16 },
  logo: { color: "#fff", fontSize: 32, fontWeight: "800", letterSpacing: 3, marginTop: 8 },
  logoHi: { color: "#fff", fontSize: 16, marginTop: 4 },
  sub: { color: "rgba(255,255,255,0.75)", fontSize: 13, marginTop: 8 },
  nhm: { color: "rgba(255,255,255,0.55)", fontSize: 10, marginTop: 8 },
  card: {
    flex: 0.62,
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -12,
  },
  cardInner: { paddingHorizontal: 28, paddingTop: 32, paddingBottom: 32, flexGrow: 1 },
  signHi: { fontSize: 22, fontWeight: "800", color: COLORS.textPrimary },
  signEn: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    overflow: "hidden",
  },
  prefixBox: {
    width: 52,
    minHeight: 52,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  prefixText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  phoneInput: { flex: 1, paddingHorizontal: 12, fontSize: 18, letterSpacing: 2, color: COLORS.textPrimary },
  error: { color: COLORS.danger, fontSize: 12, marginTop: 8 },
  cta: {
    minHeight: 52,
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
    minHeight: 52,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineText: { color: COLORS.primary, fontSize: 14, fontWeight: "700" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  footerText: { color: COLORS.textHint, fontSize: 11 },
});
