import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Q } from "@nozbe/watermelondb";
import { useDatabase } from "@nozbe/watermelondb/react";
import { COLORS } from "../constants/colors";

export function DatabaseGate({ children }) {
  const database = useDatabase();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await database.collections.get("patients").query(Q.take(1)).fetch();
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [database]);

  if (failed) {
    return (
      <View style={styles.center}>
        <Text style={styles.hi}>डेटाबेस लोड नहीं हुआ</Text>
        <Text style={styles.en}>Local database could not start.</Text>
        <Text style={styles.hint}>
          Expo Go में ऐप नहीं चलेगा। Android: npm run native:android · iOS: npm run native:ios · फिर npm run start:dev
        </Text>
        <Text style={styles.hintEn}>
          Do not use Expo Go. Android: npm run native:android · iOS: npm run native:ios · then npm run start:dev
        </Text>
      </View>
    );
  }

  if (!ready) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.en}>Loading local records…</Text>
      </View>
    );
  }

  return children;
}

DatabaseGate.propTypes = {
  children: PropTypes.node.isRequired,
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  hi: { fontSize: 14, fontWeight: "800", color: COLORS.textPrimary, textAlign: "center" },
  en: { fontSize: 11, color: COLORS.textSecondary, textAlign: "center" },
  hint: { fontSize: 14, color: COLORS.textPrimary, textAlign: "center", marginTop: 16, lineHeight: 20 },
  hintEn: { fontSize: 11, color: COLORS.textSecondary, textAlign: "center", lineHeight: 16 },
});
