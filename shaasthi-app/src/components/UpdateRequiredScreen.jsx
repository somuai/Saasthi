import { Linking, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { spacing, typography } from "../constants/design";
import { GovtButton } from "./GovtButton";
import PropTypes from "prop-types";

export function UpdateRequiredScreen({ updateUrl }) {
  return (
    <View style={styles.root}>
      <Ionicons name="cloud-offline-outline" size={64} color={COLORS.warning} />
      <Text style={styles.heading}>अपडेट आवश्यक / Update Required</Text>
      <Text style={styles.body}>
        कृपया नया संस्करण डाउनलोड करें / Please download the latest version.
      </Text>
      {updateUrl && (
        <GovtButton
          titleHi="अपडेट करें"
          titleEn="Update"
          onPress={() => Linking.openURL(updateUrl)}
        />
      )}
    </View>
  );
}

UpdateRequiredScreen.propTypes = {
  updateUrl: PropTypes.string,
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
    padding: spacing.md,
  },
  heading: {
    ...typography.title,
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.textPrimary,
    marginTop: spacing.lg,
    textAlign: "center",
  },
  body: {
    ...typography.body,
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    textAlign: "center",
  },
});
