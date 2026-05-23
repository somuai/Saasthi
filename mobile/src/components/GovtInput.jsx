import { useState } from "react";
import PropTypes from "prop-types";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { COLORS } from "../constants/colors";
import { tapTarget } from "../constants/design";
import { BilingualLabel } from "./BilingualLabel";

export function GovtInput({
  labelHi,
  labelEn: labelEnProp,
  label,
  value,
  onChangeText,
  keyboardType,
  prefix,
  placeholder,
  autoCapitalize,
  required,
  multiline,
  error,
  editable = true,
}) {
  const labelEn = labelEnProp ?? label ?? "";
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <BilingualLabel labelHi={labelHi} labelEn={labelEn} required={required} />
      <View style={[styles.inputRow, !editable && styles.disabled, focused && styles.focused, error && styles.errorBorder]}>
        {prefix ? (
          <View style={styles.prefix}>
            <Text style={styles.prefixText}>{prefix}</Text>
          </View>
        ) : null}
        <TextInput
          accessibilityHint={labelEn}
          editable={editable}
          multiline={multiline}
          placeholder={placeholder}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[styles.input, multiline && { minHeight: 80, textAlignVertical: "top" }]}
          placeholderTextColor={COLORS.textHint}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

GovtInput.propTypes = {
  labelHi: PropTypes.string.isRequired,
  /** Prefer labelEn; `label` is supported for legacy call sites */
  labelEn: (props, propName, componentName) => {
    if (!props.labelEn && !props.label) {
      return new Error(`One of \`labelEn\` or \`label\` is required in \`${componentName}\`.`);
    }
  },
  label: PropTypes.string,
  value: PropTypes.string,
  onChangeText: PropTypes.func,
  keyboardType: PropTypes.string,
  prefix: PropTypes.string,
  placeholder: PropTypes.string,
  autoCapitalize: PropTypes.string,
  required: PropTypes.bool,
  multiline: PropTypes.bool,
  error: PropTypes.string,
  editable: PropTypes.bool,
};

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 12 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    minHeight: tapTarget,
  },
  focused: { borderColor: COLORS.primary, borderWidth: 2 },
  errorBorder: { borderColor: COLORS.danger },
  disabled: { backgroundColor: "#F8F9FA" },
  prefix: {
    width: 48,
    minHeight: tapTarget,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  prefixText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  errorText: { color: COLORS.danger, fontSize: 11 },
});
