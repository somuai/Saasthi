import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useDatabase } from "@nozbe/watermelondb/react";
import { Q } from "@nozbe/watermelondb";
import { useDispatch } from "react-redux";
import { Ionicons } from "@expo/vector-icons";
import { MediliftTopBar } from "../../components/MediliftTopBar";
import { GovtButton } from "../../components/GovtButton";
import { GovtInput } from "../../components/GovtInput";
import { COLORS } from "../../constants/colors";
import { PHC_FACILITIES } from "../../constants/phcFacilities";
import { todayYmd } from "../../utils/dateHelpers";
import { incrementPendingCount } from "../../features/sync/syncSlice";
import { tapTargetMin } from "../../constants/typography";

const CONDITIONS = [
  { key: "well", icon: "happy-outline", hi: "ठीक", en: "Well" },
  { key: "mild", icon: "remove-circle-outline", hi: "हल्का", en: "Mild" },
  { key: "poor", icon: "sad-outline", hi: "खराब", en: "Poor" },
];

/**
 * Field visit log — stored in follow_ups with follow_type "field_visit".
 * notes JSON holds GPS, PHC, condition until dedicated visit_records API exists.
 */
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
  const [timestamp] = useState(() => new Date().toISOString());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!patientId) return undefined;
    const q = database.collections.get("patients").query(Q.where("id", patientId));
    const sub = q.observe().subscribe((r) => setPatient(r[0] || null));
    return () => sub.unsubscribe();
  }, [database, patientId]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setGps({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    })();
  }, []);

  async function saveVisit() {
    if (!patient) return;
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
    } finally {
      setSaving(false);
    }
  }

  if (!patient) {
    return (
      <View style={styles.page}>
        <MediliftTopBar titleHi="भेंट रिकॉर्ड" titleEn="Visit record" showBack />
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <MediliftTopBar titleHi="भेंट रिकॉर्ड" titleEn="Visit record" showBack />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color="#fff" />
          </View>
          <View>
            <Text style={styles.name}>{patient.name}</Text>
            <Text style={styles.meta}>{new Date(timestamp).toLocaleString()}</Text>
          </View>
        </View>

        <Text style={styles.labelHi}>स्थिति / Condition</Text>
        <View style={styles.condRow}>
          {CONDITIONS.map((c) => (
            <Pressable
              key={c.key}
              style={[styles.condBtn, condition === c.key && styles.condBtnOn]}
              onPress={() => setCondition(c.key)}
            >
              <Ionicons name={c.icon} size={28} color={condition === c.key ? COLORS.primary : COLORS.textSecondary} />
              <Text style={styles.condTxt}>{c.hi}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.labelHi}>सुविधा / Facility</Text>
        {PHC_FACILITIES.map((p) => (
          <Pressable
            key={p.id}
            style={[styles.phcRow, phcId === p.id && styles.phcRowOn]}
            onPress={() => setPhcId(p.id)}
          >
            <Text style={styles.phcHi}>{p.hi}</Text>
            <Text style={styles.phcEn}>{p.en}</Text>
          </Pressable>
        ))}

        <View style={styles.gpsBox}>
          <Ionicons name="location" size={20} color={COLORS.primary} />
          <Text style={styles.gpsTxt}>
            {gps
              ? `GPS: ${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`
              : "GPS अनुमति लंबित / Location pending"}
          </Text>
        </View>

        <GovtInput
          labelHi="टिप्पणी"
          labelEn="Visit notes (optional)"
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Observation, referral advice…"
        />

        <GovtButton titleHi="सहेजें" titleEn="Save visit offline" onPress={saveVisit} loading={saving} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, paddingBottom: 40 },
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
});
