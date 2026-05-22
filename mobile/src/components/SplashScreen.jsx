import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../constants/colors";
import { spacing, typography } from "../constants/design";

export function SplashScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>SHAASTHI</Text>
      <Text style={styles.subtitle}>राष्ट्रीय स्वास्थ्य मिशन</Text>
      <ActivityIndicator size="large" color="#fff" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...typography.title,
    color: "#fff",
    fontSize: 32,
    letterSpacing: 2,
  },
  subtitle: {
    ...typography.body,
    color: "rgba(255,255,255,0.9)",
    marginTop: spacing.sm,
  },
  spinner: {
    marginTop: spacing.xl,
  },
});
