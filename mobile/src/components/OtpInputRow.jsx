import PropTypes from "prop-types";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { COLORS } from "../constants/colors";
import { tapTargetMin } from "../constants/typography";

export function OtpInputRow({ value, onChange, onComplete, autoFocus, length = 6 }) {
  // Store actual DOM/native refs in a stable array — never recreated
  const inputEls = useRef([]);

  // Stable callback-ref factory: each TextInput calls this to register itself
  const setRef = useCallback((i, el) => {
    inputEls.current[i] = el;
  }, []);

  const focusInput = useCallback((i) => {
    inputEls.current[i]?.focus?.();
  }, []);

  const pad = useMemo(() => Array(length).fill(""), [length]);
  const digits = useMemo(() => {
    const chars = value.split("");
    return [...chars, ...pad].slice(0, length);
  }, [value, length, pad]);

  useEffect(() => {
    if (autoFocus) {
      // Small delay to ensure the TextInput is mounted
      const t = setTimeout(() => focusInput(0), 100);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [autoFocus, focusInput]);

  function setDigit(i, text) {
    const digitsOnly = text.replace(/\D/g, "");
    if (digitsOnly.length > 1) {
      const pasted = digitsOnly.slice(0, length);
      onChange(pasted);
      const focusIdx = Math.min(length - 1, pasted.length - 1);
      focusInput(focusIdx);
      if (pasted.length === length) onComplete?.(pasted);
      return;
    }
    const digit = digitsOnly.slice(-1);
    const next = digits.map((d, idx) => (idx === i ? digit : d));
    const joined = next.join("");
    onChange(joined);
    if (digit && i < length - 1) focusInput(i + 1);
    if (digit && i === length - 1 && joined.length === length) onComplete?.(joined);
  }

  function onKeyPress(i, e) {
    if (e.nativeEvent.key === "Backspace" && !digits[i] && i > 0) {
      focusInput(i - 1);
    }
  }

  return (
    <View style={styles.row}>
      {digits.map((d, i) => (
        <TextInput
          key={i}
          ref={(el) => setRef(i, el)}
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
