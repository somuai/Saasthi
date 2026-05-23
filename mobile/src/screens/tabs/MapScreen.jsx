import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import PropTypes from "prop-types";
import MapView, { Callout, Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { COLORS } from "../../constants/colors";
import { FEATURES } from "../../constants/featureFlags";
import { GovtHeader } from "../../components/GovtHeader";
import { apiUrl, endpoints } from "../../constants/api";
import { getAccessToken } from "../../services/auth";

const INITIAL_REGION = { latitude: 20.5937, longitude: 78.9629, latitudeDelta: 4, longitudeDelta: 4 };

const GENDER_COLORS = { female: "#E91E63", male: "#2196F3", other: "#9C27B0", unknown: "#757575" };

export default function MapScreen() {
  const router = useRouter();
  const mapRef = useRef(null);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMarker, setSelectedMarker] = useState(null);

  useEffect(() => {
    (async () => {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) console.warn("Map: location permission denied");
    })();
  }, []);

  const fetchMapData = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const res = await fetch(apiUrl(`${endpoints.patients}map_data/`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load map data");
      const data = await res.json();
      setPatients(data.results || data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchMapData();
    setRefreshing(false);
  }, [fetchMapData]);

  useEffect(() => {
    fetchMapData();
  }, [fetchMapData]);

  if (!FEATURES.OFFLINE_MAP) return null;

  return (
    <View style={styles.container}>
      <GovtHeader titleHi="नक्शा" titleEn="Patient Map" />
      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ flex: 1 }} />
      ) : error ? (
        <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={32} color={COLORS.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={fetchMapData} style={styles.retryBtn}>
              <Text style={styles.retryText}>पुनः प्रयास / Retry</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={INITIAL_REGION}
          showsUserLocation
          showsCompass
          showsScale
          onPress={() => setSelectedMarker(null)}
        >
          {patients.map((pt) => {
            if (pt.household_lat == null || pt.household_lng == null) return null;
            const isSelected = selectedMarker === pt.id;
            const color = GENDER_COLORS[pt.gender] || COLORS.primary;
            return (
              <Marker
                key={pt.id || pt.local_uuid}
                coordinate={{ latitude: pt.household_lat, longitude: pt.household_lng }}
                pinColor={isSelected ? COLORS.accent : color}
                opacity={selectedMarker && !isSelected ? 0.5 : 1}
                onPress={() => setSelectedMarker(pt.id)}
              >
                <Callout onPress={() => router.push(`/patients/${pt.id}`)}>
                  <View style={styles.callout}>
                    <Text style={styles.calloutName}>{pt.full_name}</Text>
                    {pt.village ? <Text style={styles.calloutDetail}>{pt.village}</Text> : null}
                    <Text style={styles.calloutLink}>View Patient →</Text>
                  </View>
                </Callout>
              </Marker>
            );
          })}
        </MapView>
      )}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>{patients.length} लाभार्थी / Patients</Text>
        <View style={styles.legendRow}>
          <MarkerIcon color={GENDER_COLORS.female} />
          <Text style={styles.legendLabel}>महिला</Text>
          <MarkerIcon color={GENDER_COLORS.male} />
          <Text style={styles.legendLabel}>पुरुष</Text>
        </View>
      </View>
    </View>
  );
}

function MarkerIcon({ color }) {
  return <View style={[styles.markerDot, { backgroundColor: color }]} />;
}
MarkerIcon.propTypes = { color: PropTypes.string.isRequired };

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  map: { flex: 1 },
  errorBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  errorText: { color: COLORS.danger, fontSize: 14, marginTop: 8, textAlign: "center" },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    minHeight: 48,
    justifyContent: "center",
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 14, textAlign: "center" },
  callout: { padding: 8, minWidth: 120 },
  calloutName: { fontWeight: "700", fontSize: 14, marginBottom: 4 },
  calloutDetail: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  calloutLink: { color: COLORS.accent, fontSize: 12, fontWeight: "700" },
  legend: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  legendTitle: { fontWeight: "700", fontSize: 13, marginBottom: 8 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  legendLabel: { fontSize: 12, color: COLORS.textSecondary },
  markerDot: { width: 12, height: 12, borderRadius: 6 },
});
