import PropTypes from "prop-types";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../constants/colors";
import { SeverityPill } from "./SeverityPill";
import { ToggleRow } from "./ToggleRow";
import { GovtInput } from "./GovtInput";
import { localizePair, useLocale } from "../utils/localization";

export function SymptomCard({ labelHi, labelEn, value, onChange }) {
  const present = value?.present === true;
  const locale = useLocale();
  return (
    <View style={styles.card}>
      <ToggleRow
        labelHi={labelHi}
        labelEn={labelEn}
        value={present ? true : present === false ? false : undefined}
        onChange={(v) => onChange?.({ ...value, present: v, severity: v ? value?.severity || "mild" : null })}
      />
      {present ? (
        <View style={styles.body}>
          <Text style={styles.sevLabel}>{localizePair("गंभीरता", "Severity", locale)}</Text>
          <SeverityPill value={value?.severity || "mild"} onChange={(severity) => onChange?.({ ...value, present: true, severity })} />
          <GovtInput
            labelHi="दिन (वैकल्पिक)"
            label="Days (optional)"
            value={value?.days != null ? String(value.days) : ""}
            onChangeText={(t) => onChange?.({ ...value, present: true, days: t ? Number(t) : null })}
            keyboardType="number-pad"
          />
        </View>
      ) : null}
    </View>
  );
}

SymptomCard.propTypes = {
  labelHi: PropTypes.string.isRequired,
  labelEn: PropTypes.string.isRequired,
  value: PropTypes.shape({
    present: PropTypes.bool,
    severity: PropTypes.string,
    days: PropTypes.number,
  }),
  onChange: PropTypes.func,
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    overflow: "hidden",
  },
  body: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  sevLabel: { fontSize: 12, fontWeight: "700", color: COLORS.textSecondary },
});
