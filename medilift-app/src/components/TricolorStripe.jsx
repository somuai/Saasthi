import { StyleSheet, View } from "react-native";
import { COLORS } from "../constants/colors";

export function TricolorStripe() {
  return (
    <View style={styles.row}>
      <View style={[styles.segment, { backgroundColor: COLORS.tricolorSaffron }]} />
      <View style={[styles.segment, { backgroundColor: COLORS.tricolorWhite }]} />
      <View style={[styles.segment, { backgroundColor: COLORS.tricolorGreen }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", height: 3, width: "100%" },
  segment: { flex: 1 },
});
