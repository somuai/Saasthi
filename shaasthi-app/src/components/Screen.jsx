import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "../constants/design";

export function Screen({ children, scroll = true, style }) {
  return (
    <SafeAreaView style={styles.safe}>
      {scroll ? (
        <ScrollView style={styles.scrollContainer} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
          <View style={[styles.contentScroll, style]}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[styles.contentNoScroll, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scrollContainer: { flex: 1 },
  scroll: { flexGrow: 1 },
  contentScroll: { gap: spacing.lg, padding: spacing.lg },
  contentNoScroll: { flex: 1, gap: spacing.lg, padding: spacing.lg },
});
