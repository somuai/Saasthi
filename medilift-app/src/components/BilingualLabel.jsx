import PropTypes from "prop-types";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../constants/colors";
import { TYPOGRAPHY } from "../constants/typography";

export function BilingualLabel({ labelHi, labelEn, required, size = "md" }) {
  const hiStyle = size === "sm" ? TYPOGRAPHY.hindiPrimarySm : TYPOGRAPHY.hindiPrimaryMd;
  const enStyle = size === "sm" ? TYPOGRAPHY.englishSecondarySm : TYPOGRAPHY.englishSecondaryMd;
  return (
    <View style={styles.wrap}>
      <Text style={hiStyle}>
        {labelHi}
        {required ? <Text style={styles.req}> *</Text> : null}
      </Text>
      <Text style={enStyle}>{labelEn}</Text>
    </View>
  );
}

BilingualLabel.propTypes = {
  labelHi: PropTypes.string.isRequired,
  labelEn: PropTypes.string.isRequired,
  required: PropTypes.bool,
  size: PropTypes.oneOf(["sm", "md"]),
};

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  req: { color: COLORS.danger },
});
