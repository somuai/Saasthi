import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDatabase } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import { useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { ShaasthiTopBar } from "../../components/ShaasthiTopBar";
import { GovtButton } from "../../components/GovtButton";
import { GovtInput } from "../../components/GovtInput";
import { OtpInputRow } from "../../components/OtpInputRow";
import { VoiceInputButton } from "../../components/ui/VoiceInputButton";
import { useSpeechInput } from "../../hooks/useSpeechInput";
import { LoadingState } from "../../components/LoadingState";
import { COLORS } from "../../constants/colors";
import { FEATURES } from "../../constants/featureFlags";
import { apiUrl } from "../../constants/api";
import { PHC_FACILITIES } from "../../constants/phcFacilities";
import { todayYmd } from "../../utils/dateHelpers";
import { incrementPendingCount } from "../../features/sync/syncSlice";
import { tapTargetMin } from "../../constants/typography";
import * as SecureStore from "expo-secure-store";

const CONDITIONS = [
  { key: "well", icon: "happy-outline", hi: "ठीक", en: "Well" },
  { key: "mild", icon: "remove-circle-outline", hi: "हल्का", en: "Mild" },
  { key: "poor", icon: "sad-outline", hi: "खराब", en: "Poor" },
];

/**
 * Field visit log — stored in follow_ups with follow_type "field_visit".
 * notes JSON holds GPS, PHC, condition until dedicated visit_records API exists.
 */
const OTP_FLOW = { PENDING: 0, REQUESTED: 1, VERIFIED: 2, BYPASSED: 3 };

export default function VisitRecordScreen() {
  const { id: patientId } = useLocalSearchParams();
  const database = useDatabase();
  const dispatch = useDispatch();
  const router = useRouter();
  const [patient, setPatient] = useState(null);
  const [condition, setCondition] = useState("well");
  const [phcId, setPhcId] = useState(PHC_FACILITIES[0]?.id);
  const [notes, setNotes] = useState("");
  const [gps, setGps] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [gpsRetries, setGpsRetries] = useState(0);
  const [timestamp] = useState(() => new Date().toISOString());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [otpStep, setOtpStep] = useState(OTP_FLOW.PENDING);
  const [otpId, setOtpId] = useState(null);
  const [otpValue, setOtpValue] = useState("");
  const speech = useSpeechInput((text) => setNotes((prev) => (prev ? `${prev}\n${text}` : text)));
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [formUnlocked, setFormUnlocked] = useState(false);

  useEffect(() => {
    if (!patientId) return undefined;
    const q = database.collections.get("patients").query(Q.where("id", patientId));
    const sub = q.observe().subscribe((r) => setPatient(r[0] || null));
    return () => sub.unsubscribe();
  }, [database, patientId]);

  useEffect(() => {
    if (!FEATURES.GPS_TRACKING) {
      setGpsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== "granted") {
        setGpsLoading(false);
        return;
      }
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
          timeout: 15000,
        });
        if (cancelled) return;
        setGps({
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
          timestamp: loc.timestamp,
        });
      } catch {
        if (cancelled) return;
        // keep gpsLoading true — user can retry
      } finally {
        if (!cancelled) setGpsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gpsRetries]);

  function retryGps() {
    setGpsLoading(true);
    setGps(null);
    setGpsRetries((r) => r + 1);
  }

  async function saveVisit() {
    if (!patient) return;
    if (FEATURES.GPS_TRACKING && !gps) {
      setSaveError("GPS स्थान उपलब्ध नहीं है / GPS location not available. Please wait or disable location.");
      return;
    }
    setSaving(true);
    const now = Date.now();
    const day = todayYmd();
    const phc = PHC_FACILITIES.find((p) => p.id === phcId);
    const payload = {
      condition,
      phcId,
      phcLabel: phc?.en,
      gps,
      recordedAt: timestamp,
      notes,
    };
    try {
      await database.write(async () => {
        await database.collections.get("follow_ups").create((f) => {
          f.patientId = patient.id;
          f.dueDate = day;
          f.completedDate = day;
          f.isCompleted = true;
          f.isOverdue = false;
          f.followType = "field_visit";
          f.outcome = condition;
          f.notes = JSON.stringify(payload);
          f.visitLat = gps?.lat ?? null;
          f.visitLng = gps?.lng ?? null;
          f.visitAccuracyM = gps?.accuracy ?? null;
          f.visitGpsTimestamp = gps?.timestamp ? new Date(gps.timestamp).toISOString() : null;
          f.isSynced = false;
          f.isDeleted = false;
          f.isMock = false;
          f.createdAt = now;
          f.updatedAt = now;
        });
        await patient.update((p) => {
          p.lastVisited = day;
          p.isSynced = false;
          p.updatedAt = now;
        });
      });
      dispatch(incrementPendingCount(1));
      router.back();
    } catch (e) {
      setSaveError(e?.message || "Failed to save visit");
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestOtp() {
    setOtpLoading(true);
    setOtpError("");
    try {
      const token = await SecureStore.getItemAsync("accessToken");
      const res = await fetch(apiUrl("/followups/verify/request-otp/"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ patient_id: patient.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed");
      if (data.status === "no_phone") {
        setOtpStep(OTP_FLOW.BYPASSED);
        setFormUnlocked(true);
        return;
      }
      setOtpId(data.otp_id);
      setOtpStep(OTP_FLOW.REQUESTED);
    } catch (e) {
      setOtpError(e.message || "Network error");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleVerifyOtp(code) {
    if (!otpId || code.length < 4) return;
    setOtpLoading(true);
    setOtpError("");
    try {
      const token = await SecureStore.getItemAsync("accessToken");
      const res = await fetch(apiUrl("/followups/verify/verify-otp/"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ otp_id: otpId, otp_input: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Verification failed");
      setOtpStep(OTP_FLOW.VERIFIED);
      setFormUnlocked(true);
    } catch (e) {
      setOtpError(e.message || "Wrong OTP");
      setOtpValue("");
    } finally {
      setOtpLoading(false);
    }
  }

  async function handleBypassOtp() {
    setOtpLoading(true);
    setOtpError("");
    try {
      const token = await SecureStore.getItemAsync("accessToken");
      const res = await fetch(apiUrl("/followups/verify/bypass-otp/"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ patient_id: patient.id, reason: "no_phone" }),
      });
      if (!res.ok) throw new Error("Bypass failed");
      setOtpStep(OTP_FLOW.BYPASSED);
      setFormUnlocked(true);
    } catch (e) {
      setOtpError(e.message);
    } finally {
      setOtpLoading(false);
    }
  }

  if (!patient) {
    return (
      <View style={styles.page}>
        <ShaasthiTopBar titleHi="भेंट रिकॉर्ड" titleEn="Visit record" showBack />
        <LoadingState />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <ShaasthiTopBar titleHi="भेंट रिकॉर्ड" titleEn="Visit record" showBack />
      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color="#fff" />
          </View>
          <View>
            <Text style={styles.name}>{patient.name}</Text>
            <Text style={styles.meta}>{new Date(timestamp).toLocaleString()}</Text>
          </View>
        </View>

        {FEATURES.VISIT_VERIFICATION_OTP && !formUnlocked ? (
          <View style={styles.otpSection}>
            {otpStep === OTP_FLOW.PENDING ? (
              <GovtButton titleHi="OTP भेजें" titleEn="Send OTP" onPress={handleRequestOtp} loading={otpLoading} />
            ) : otpStep === OTP_FLOW.REQUESTED ? (
              <View>
                <Text style={styles.otpLabel}>परिवार को OTP दें / Ask household for OTP</Text>
                <OtpInputRow value={otpValue} onChange={setOtpValue} onComplete={handleVerifyOtp} length={4} autoFocus />
                {otpError ? <Text style={styles.otpError}>{otpError}</Text> : null}
                {otpLoading ? <ActivityIndicator style={{ marginTop: 12 }} /> : null}
                <View style={styles.otpActions}>
                  <Pressable onPress={handleRequestOtp} style={styles.otpLink}>
                    <Text style={styles.otpLinkTxt}>पुनः भेजें / Resend</Text>
                  </Pressable>
                  <Pressable onPress={handleBypassOtp} style={styles.otpLink}>
                    <Text style={styles.otpLinkTxt}>फ़ोन नहीं? / No phone?</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        ) : FEATURES.VISIT_VERIFICATION_OTP && formUnlocked ? (
          <View style={[styles.verifyBadge, otpStep === OTP_FLOW.VERIFIED ? styles.verifyBadgeGreen : styles.verifyBadgeAmber]}>
            <Ionicons name={otpStep === OTP_FLOW.VERIFIED ? "checkmark-circle" : "alert-circle"} size={18} color="#fff" />
            <Text style={styles.verifyBadgeTxt}>
              {otpStep === OTP_FLOW.VERIFIED ? "पुष्टि भेंट / Visit Verified ✓" : "बिना फ़ोन सत्यापन / No phone verification"}
            </Text>
          </View>
        ) : null}

        <Text style={styles.labelHi}>स्थिति / Condition</Text>
        <View style={styles.condRow}>
          {CONDITIONS.map((c) => (
            <Pressable key={c.key} style={[styles.condBtn, condition === c.key && styles.condBtnOn]} onPress={() => setCondition(c.key)}>
              <Ionicons name={c.icon} size={28} color={condition === c.key ? COLORS.primary : COLORS.textSecondary} />
              <Text style={styles.condTxt}>{c.hi}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.labelHi}>सुविधा / Facility</Text>
        {PHC_FACILITIES.map((p) => (
          <Pressable key={p.id} style={[styles.phcRow, phcId === p.id && styles.phcRowOn]} onPress={() => setPhcId(p.id)}>
            <Text style={styles.phcHi}>{p.hi}</Text>
            <Text style={styles.phcEn}>{p.en}</Text>
          </Pressable>
        ))}

        <View style={styles.gpsBox}>
          <Ionicons name="location" size={20} color={COLORS.primary} />
          {gpsLoading ? (
            <View style={styles.gpsLoadingRow}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.gpsTxt}>GPS प्राप्त कर रहा है… / Acquiring location…</Text>
            </View>
          ) : gps ? (
            <Text style={styles.gpsTxt}>
              GPS: {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
            </Text>
          ) : (
            <Pressable onPress={retryGps} style={styles.gpsRetryBtn}>
              <Text style={styles.gpsRetryTxt}>GPS पुनः प्रयास करें / Retry GPS</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.notesRow}>
          <GovtInput
            labelHi="टिप्पणी"
            labelEn="Visit notes (optional)"
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Observation, referral advice…"
            containerStyle={{ flex: 1 }}
          />
          {FEATURES.VOICE_INPUT && (
            <VoiceInputButton
              onTranscript={(text) => setNotes((prev) => (prev ? `${prev}\n${text}` : text))}
              isListening={speech.isListening}
              isSupported={speech.isSupported}
              onStart={speech.startListening}
              onStop={speech.stopListening}
            />
          )}
        </View>

        <GovtButton titleHi="सहेजें" titleEn="Save visit offline" onPress={saveVisit} loading={saving} />
        {saveError ? <Text style={styles.errorTxt}>{saveError}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  scrollContainer: { flex: 1 },
  scroll: { flexGrow: 1, padding: 16, paddingBottom: 40 },
  muted: { padding: 16, color: COLORS.textSecondary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 18, fontWeight: "800", color: COLORS.textPrimary },
  meta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  labelHi: { fontSize: 14, fontWeight: "800", color: COLORS.textPrimary, marginBottom: 8 },
  condRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  condBtn: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    minHeight: tapTargetMin + 16,
  },
  condBtnOn: { borderColor: COLORS.primary, backgroundColor: COLORS.navyLight },
  condTxt: { fontSize: 12, marginTop: 6, fontWeight: "700" },
  phcRow: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    marginBottom: 8,
    minHeight: tapTargetMin,
  },
  phcRowOn: { borderColor: COLORS.primary, backgroundColor: COLORS.navyLight },
  phcHi: { fontWeight: "700", color: COLORS.textPrimary },
  phcEn: { fontSize: 11, color: COLORS.textSecondary },
  gpsBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    backgroundColor: COLORS.navyLight,
    borderRadius: 8,
    marginVertical: 16,
  },
  gpsTxt: { flex: 1, fontSize: 12, color: COLORS.textPrimary },
  errorTxt: { color: COLORS.danger, fontSize: 13, textAlign: "center", marginTop: 8 },
  otpSection: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  otpLabel: { fontSize: 13, color: COLORS.textPrimary, fontWeight: "700", marginBottom: 12 },
  otpError: { color: COLORS.danger, fontSize: 12, marginTop: 8, textAlign: "center" },
  otpActions: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  otpLink: { minHeight: tapTargetMin, justifyContent: "center" },
  otpLinkTxt: { color: COLORS.accent, fontSize: 13, fontWeight: "800" },
  verifyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  verifyBadgeGreen: { backgroundColor: COLORS.success },
  verifyBadgeAmber: { backgroundColor: "#D4A017" },
  verifyBadgeTxt: { color: "#fff", fontSize: 13, fontWeight: "700", flex: 1 },
  notesRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  gpsLoadingRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  gpsRetryBtn: { minHeight: tapTargetMin, justifyContent: "center" },
  gpsRetryTxt: { color: COLORS.accent, fontSize: 13, fontWeight: "800" },
});
