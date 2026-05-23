import PropTypes from "prop-types";
import React, { useEffect, useRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { COLORS } from "../constants/colors";
import { tapTargetMin } from "../constants/typography";

export function OtpInputRow({ value, onChange, onComplete, autoFocus, length = 6 }) {
  const refs = useRef([]);
  if (refs.current.length !== length) {
    refs.current = Array(length)
      .fill(null)
      .map(() => React.createRef());
  }
  const pad = Array(length - value.length).fill("");
  const digits = value.length === length ? value.split("") : [...value.split(""), ...pad].slice(0, length);

  useEffect(() => {
    if (autoFocus) refs[0].current?.focus?.();
  }, [autoFocus]);

  function setDigit(i, text) {
    const digitsOnly = text.replace(/\D/g, "");
    if (digitsOnly.length > 1) {
      const pasted = digitsOnly.slice(0, length);
      onChange(pasted);
      const focusIdx = Math.min(length - 1, pasted.length - 1);
      refs[focusIdx].current?.focus?.();
      if (pasted.length === length) onComplete?.(pasted);
      return;
    }
    const digit = digitsOnly.slice(-1);
    const next = digits.map((d, idx) => (idx === i ? digit : d));
    const joined = next.join("");
    onChange(joined);
    if (digit && i < length - 1) refs[i + 1].current?.focus?.();
    if (digit && i === length - 1 && joined.length === length) onComplete?.(joined);
  }

  function onKeyPress(i, e) {
    if (e.nativeEvent.key === "Backspace" && !digits[i] && i > 0) {
      refs[i - 1].current?.focus?.();
    }
  }

  return (
    <View style={styles.row}>
      {digits.map((d, i) => (
        <TextInput
          key={i}
          ref={refs[i]}
          style={[styles.box, d ? styles.boxFilled : null]}
          keyboardType="number-pad"
          maxLength={1}
          value={d}
          onChangeText={(t) => setDigit(i, t)}
          onKeyPress={(e) => onKeyPress(i, e)}
          accessibilityLabel={`OTP digit ${i + 1}`}
        />
      ))}
    </View>
  );
}

OtpInputRow.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  onComplete: PropTypes.func,
  autoFocus: PropTypes.bool,
  length: PropTypes.number,
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  box: {
    flex: 1,
    maxWidth: 52,
    height: tapTargetMin,
    minHeight: tapTargetMin,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.textPrimary,
    paddingTop: 8,
  },
  boxFilled: { borderColor: COLORS.primary },
});
