import { Component } from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS } from "../constants/colors";
import { spacing, typography } from "../constants/design";
import { GovtButton } from "./GovtButton";
import Sentry from "../utils/sentry";

const initialState = { hasError: false, error: null };

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = initialState;
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info?.componentStack || "");
    Sentry.captureException(error, {
      extra: { componentStack: info?.componentStack },
    });
  }

  handleReset = () => this.setState(initialState);

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>कुछ गड़बड़ हुई</Text>
          <Text style={styles.subtitle}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error?.message || "An unexpected error occurred."}</Text>
          <GovtButton titleHi="पुनः प्रयास करें" titleEn="Retry" onPress={this.handleReset} />
        </View>
      );
    }
    return this.props.children;
  }
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
  title: { ...typography.title, textAlign: "center" },
  subtitle: { ...typography.body, color: COLORS.muted, textAlign: "center" },
  message: { ...typography.label, textAlign: "center", color: COLORS.error, marginBottom: spacing.lg },
});
