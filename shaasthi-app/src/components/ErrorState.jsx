import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { spacing } from "../constants/design";
import { GovtButton } from "./GovtButton";

export function ErrorState({ message = "Something went wrong.", onRetry }) {
  return (
    <View style={styles.container}>
      <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
      <Text style={styles.text}>{message}</Text>
      {onRetry && <GovtButton titleHi="पुनः प्रयास करें" titleEn="Retry" onPress={onRetry} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    padding: spacing.xl,
    gap: spacing.md,
  },
  text: { color: COLORS.textSecondary, fontSize: 14, textAlign: "center" },
});
