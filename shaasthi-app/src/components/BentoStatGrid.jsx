import PropTypes from "prop-types";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";

export function BentoStatGrid({ items }) {
  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View key={item.key} style={styles.tile}>
          <Ionicons name={item.icon} size={22} color={item.color || COLORS.primary} />
          <Text style={[styles.value, { color: item.color || COLORS.textPrimary }]}>{item.value}</Text>
          <Text style={styles.hi}>{item.labelHi}</Text>
          <Text style={styles.en}>{item.labelEn}</Text>
        </View>
      ))}
    </View>
  );
}

BentoStatGrid.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string.isRequired,
      icon: PropTypes.string.isRequired,
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      labelHi: PropTypes.string.isRequired,
      labelEn: PropTypes.string.isRequired,
      color: PropTypes.string,
    })
  ).isRequired,
};

const styles = StyleSheet.create({
  grid: { flexDirection: "row", gap: 8 },
  tile: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    alignItems: "center",
    minHeight: 88,
  },
  value: { fontSize: 18, fontWeight: "800", marginTop: 4 },
  hi: { fontSize: 10, fontWeight: "700", color: COLORS.textPrimary, marginTop: 2, textAlign: "center" },
  en: { fontSize: 9, color: COLORS.textSecondary, textAlign: "center" },
});
