import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../../constants/colors";
import { tapTargetMin } from "../../constants/typography";

export function VoiceInputButton({ onTranscript, isListening, isSupported, onStart, onStop }) {
  if (!isSupported) return null;

  return (
    <Pressable
      style={[styles.btn, isListening && styles.btnActive]}
      onPress={isListening ? onStop : onStart}
      accessibilityLabel={isListening ? "Stop recording" : "Start voice input"}
    >
      <Ionicons
        name={isListening ? "mic" : "mic-outline"}
        size={22}
        color={isListening ? "#fff" : COLORS.primary}
      />
      <Text style={[styles.label, isListening && styles.labelActive]}>
        {isListening ? "बोल रहे… / Listening…" : "बोलें / Speak"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: tapTargetMin,
    minWidth: tapTargetMin,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  btnActive: {
    backgroundColor: COLORS.danger,
    borderColor: COLORS.danger,
  },
  label: { fontSize: 12, fontWeight: "700", color: COLORS.primary },
  labelActive: { color: "#fff" },
});
