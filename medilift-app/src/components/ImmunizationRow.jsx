import PropTypes from "prop-types";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { isoDate, getDaysOverdue } from "../utils/immunizationSchedule";

const FAMILY_COLORS = {
  OPV: "#2563EB",
  PENTA: "#138808",
  ROTA: "#EC4899",
  PCV: "#6C3483",
  BCG: COLORS.primary,
  HEPB: "#0D9488",
  MR: COLORS.accent,
  JE: COLORS.danger,
  DPT: "#92400E",
  VITA: "#EAB308",
  IPV: "#6366F1",
  TT: "#64748B",
};

function familyColor(code) {
  const c = (code || "").toUpperCase();
  if (c.includes("OPV")) return FAMILY_COLORS.OPV;
  if (c.includes("PENTA")) return FAMILY_COLORS.PENTA;
  if (c.includes("ROTA")) return FAMILY_COLORS.ROTA;
  if (c.includes("PCV")) return FAMILY_COLORS.PCV;
  if (c.includes("BCG")) return FAMILY_COLORS.BCG;
  if (c.includes("HEP")) return FAMILY_COLORS.HEPB;
  if (c.includes("MR")) return FAMILY_COLORS.MR;
  if (c.includes("JE")) return FAMILY_COLORS.JE;
  if (c.includes("DPT")) return FAMILY_COLORS.DPT;
  if (c.includes("VITA")) return FAMILY_COLORS.VITA;
  if (c.includes("IPV")) return FAMILY_COLORS.IPV;
  if (c.includes("TT")) return FAMILY_COLORS.TT;
  return COLORS.primary;
}

export function ImmunizationRow({ vaccine, onGive }) {
  const { name, nameHi, scheduledDate, administeredDate, isMissed, isAdministered, vaccineCode } = vaccine;
  const dot = familyColor(vaccineCode);
  const today = isoDate(new Date());
  const dueStr = scheduledDate ? String(scheduledDate).slice(0, 10) : "";
  const overdue = dueStr && dueStr < today && !isAdministered;

  let statusRight = null;
  if (isAdministered) {
    statusRight = (
      <View style={styles.rightCol}>
        <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
        <Text style={styles.small}>{administeredDate?.slice?.(0, 10) || ""}</Text>
      </View>
    );
  } else if (isMissed) {
    statusRight = (
      <View style={styles.rightCol}>
        <Ionicons name="close-circle" size={22} color={COLORS.danger} />
        <Text style={styles.missed}>चूका / Missed</Text>
      </View>
    );
  } else if (overdue) {
    statusRight = (
      <Text style={styles.overdue}>
        Overdue {getDaysOverdue(dueStr)}d / देर {getDaysOverdue(dueStr)}
      </Text>
    );
  } else if (dueStr === today) {
    statusRight = (
      <Pressable style={styles.giveBtn} onPress={() => onGive?.(vaccine)}>
        <Text style={styles.giveText}>दें / Give</Text>
      </Pressable>
    );
  } else {
    statusRight = (
      <View style={styles.rightCol}>
        <Ionicons name="time-outline" size={20} color={COLORS.textHint} />
        <Text style={styles.small}>{dueStr}</Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <View style={[styles.circle, { backgroundColor: dot }]} />
      <View style={styles.center}>
        <Text style={styles.hi}>{nameHi || name}</Text>
        <Text style={styles.en}>{name}</Text>
        <Text style={[styles.due, overdue && { color: COLORS.danger }]}>
          Due: {dueStr || "—"}
          {dueStr === today ? " · Today" : ""}
        </Text>
      </View>
      {statusRight}
    </View>
  );
}

ImmunizationRow.propTypes = {
  vaccine: PropTypes.shape({
    name: PropTypes.string,
    nameHi: PropTypes.string,
    scheduledDate: PropTypes.string,
    administeredDate: PropTypes.string,
    isMissed: PropTypes.bool,
    isAdministered: PropTypes.bool,
    vaccineCode: PropTypes.string,
  }).isRequired,
  onGive: PropTypes.func,
};

const styles = StyleSheet.create({
  row: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    gap: 10,
  },
  circle: { width: 40, height: 40, borderRadius: 20 },
  center: { flex: 1 },
  hi: { fontSize: 13, fontWeight: "800", color: COLORS.textPrimary },
  en: { fontSize: 11, color: COLORS.textSecondary },
  due: { fontSize: 11, color: COLORS.textHint, marginTop: 2 },
  overdue: { fontSize: 11, color: COLORS.danger, fontWeight: "700", maxWidth: 100 },
  rightCol: { alignItems: "center", width: 72 },
  small: { fontSize: 11, color: COLORS.textSecondary },
  missed: { fontSize: 10, color: COLORS.danger, fontWeight: "700" },
  giveBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  giveText: { color: "#fff", fontSize: 12, fontWeight: "800" },
});
