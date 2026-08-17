import PropTypes from "prop-types";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../constants/colors";
import { scriptFontFamily, TYPOGRAPHY } from "../constants/typography";
import { translateHindiText, useLocale } from "../utils/localization";

export function BilingualLabel({ labelHi, labelEn, required, size = "md" }) {
  const locale = useLocale();
  // Primary label is rendered in the user's script — Bengali, Devanagari, or Latin.
  // The font family MUST match the script or glyphs render as tofu.
  const primaryFont = scriptFontFamily(locale);
  const primaryBase = size === "sm" ? TYPOGRAPHY.hindiPrimarySm : TYPOGRAPHY.hindiPrimaryMd;
  const hiStyle = { ...primaryBase, fontFamily: primaryFont };
  const enStyle = size === "sm" ? TYPOGRAPHY.englishSecondarySm : TYPOGRAPHY.englishSecondaryMd;
  const primaryLabel = locale === "en" ? labelEn : translateHindiText(labelHi, locale);
  return (
    <View style={styles.wrap}>
      <Text style={hiStyle}>
        {primaryLabel}
        {required ? <Text style={styles.req}> *</Text> : null}
      </Text>
      {locale === "en" ? null : <Text style={enStyle}>{labelEn}</Text>}
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
