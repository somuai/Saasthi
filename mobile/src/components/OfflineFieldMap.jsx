import PropTypes from "prop-types";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { localizePair, useLocale } from "../utils/localization";

function boundsForPoints(markers, userLocation, routeTarget) {
  const points = markers.map((marker) => ({ latitude: marker.latitude, longitude: marker.longitude }));
  if (userLocation) points.push(userLocation);
  if (routeTarget) points.push(routeTarget);
  if (!points.length) return null;

  let minLat = points[0].latitude;
  let maxLat = points[0].latitude;
  let minLng = points[0].longitude;
  let maxLng = points[0].longitude;

  points.forEach((point) => {
    minLat = Math.min(minLat, point.latitude);
    maxLat = Math.max(maxLat, point.latitude);
    minLng = Math.min(minLng, point.longitude);
    maxLng = Math.max(maxLng, point.longitude);
  });

  const latPad = Math.max((maxLat - minLat) * 0.15, 0.002);
  const lngPad = Math.max((maxLng - minLng) * 0.15, 0.002);
  return {
    minLat: minLat - latPad,
    maxLat: maxLat + latPad,
    minLng: minLng - lngPad,
    maxLng: maxLng + lngPad,
  };
}

function positionFor(point, bounds) {
  if (!bounds) return { left: "50%", top: "50%" };
  const lngRange = bounds.maxLng - bounds.minLng || 1;
  const latRange = bounds.maxLat - bounds.minLat || 1;
  const left = ((point.longitude - bounds.minLng) / lngRange) * 100;
  const top = (1 - (point.latitude - bounds.minLat) / latRange) * 100;
  return {
    left: `${Math.max(6, Math.min(94, left))}%`,
    top: `${Math.max(6, Math.min(94, top))}%`,
  };
}

export function OfflineFieldMap({ markers, userLocation, routeTarget, onMarkerPress }) {
  const locale = useLocale();
  const bounds = boundsForPoints(markers, userLocation, routeTarget);

  return (
    <View style={styles.wrap}>
      <View style={styles.notice}>
        <View style={styles.noticeLeft}>
          <View style={styles.offlineDot} />
          <Ionicons name="cloud-offline-outline" size={16} color={COLORS.primary} style={{ marginRight: 4 }} />
          <Text style={styles.noticeText}>
            {localizePair("ऑफ़लाइन ग्राम नक्शा (सिंक किया हुआ)", "Offline Village Map (Synced)", locale)}
          </Text>
        </View>
        <Text style={styles.noticeSub}>{localizePair("बिना इंटरनेट के कार्य कर रहा है", "Running without Internet", locale)}</Text>
      </View>

      <View style={styles.field}>
        {/* Stylized premium topographic background elements */}
        <View style={styles.mapGridPattern} />
        <View style={[styles.contourRing, { width: 300, height: 300, top: "10%", left: "-10%" }]} />
        <View style={[styles.contourRing, { width: 400, height: 400, bottom: "-10%", right: "-10%" }]} />

        {/* Compass Rose */}
        <View style={styles.compassContainer}>
          <Ionicons name="compass-outline" size={32} color="rgba(65, 108, 175, 0.25)" />
          <Text style={styles.compassText}>N</Text>
        </View>

        {!markers.length && !routeTarget ? (
          <View style={styles.empty}>
            <Ionicons name="location-outline" size={34} color={COLORS.textHint} />
            <Text style={styles.emptyTitle}>{localizePair("GPS वाले मरीज नहीं मिले", "No mapped patients", locale)}</Text>
            <Text style={styles.emptyText}>
              {localizePair("सिंक के बाद GPS वाले घर यहां दिखेंगे।", "Households with GPS will appear here after sync.", locale)}
            </Text>
          </View>
        ) : null}

        {/* Route visualization line when target is active */}
        {userLocation && routeTarget && bounds ? (
          <View style={styles.routeOverlayContainer}>
            {/* Draw a subtle visual indicator or connection line if possible, or just the dots */}
          </View>
        ) : null}

        {markers.map((marker) => {
          const pos = positionFor(marker, bounds);
          return (
            <Pressable
              key={marker.id}
              accessibilityRole="button"
              accessibilityLabel={`${marker.title}, ${marker.subtitle}`}
              onPress={() => onMarkerPress?.(marker.id)}
              style={[styles.markerContainer, { left: pos.left, top: pos.top }]}
            >
              <View style={[styles.marker, { backgroundColor: marker.color }]}>
                {marker.patientCount > 1 ? (
                  <Text style={styles.markerText}>{marker.patientCount}</Text>
                ) : marker.pregnantCount > 0 ? (
                  <Text style={styles.markerText}>🤰</Text>
                ) : marker.childCount > 0 ? (
                  <Text style={styles.markerText}>👶</Text>
                ) : (
                  <View style={styles.markerCore} />
                )}
              </View>
              {marker.pregnantCount > 0 && (
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>!</Text>
                </View>
              )}
            </Pressable>
          );
        })}

        {userLocation ? (
          <View style={[styles.userMarker, positionFor(userLocation, bounds)]}>
            <View style={styles.pulseRing} />
            <View style={styles.userMarkerCore} />
          </View>
        ) : null}

        {routeTarget ? (
          <View style={[styles.targetMarker, positionFor(routeTarget, bounds)]}>
            <Ionicons name="medical" size={12} color="#fff" />
          </View>
        ) : null}
      </View>
    </View>
  );
}

OfflineFieldMap.propTypes = {
  markers: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      latitude: PropTypes.number.isRequired,
      longitude: PropTypes.number.isRequired,
      title: PropTypes.string,
      subtitle: PropTypes.string,
      color: PropTypes.string,
      patientCount: PropTypes.number,
      pregnantCount: PropTypes.number,
      childCount: PropTypes.number,
    }),
  ),
  userLocation: PropTypes.shape({
    latitude: PropTypes.number.isRequired,
    longitude: PropTypes.number.isRequired,
  }),
  routeTarget: PropTypes.shape({
    latitude: PropTypes.number.isRequired,
    longitude: PropTypes.number.isRequired,
    name: PropTypes.string.isRequired,
  }),
  onMarkerPress: PropTypes.func,
};

OfflineFieldMap.defaultProps = {
  markers: [],
  userLocation: null,
  routeTarget: null,
  onMarkerPress: undefined,
};

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: "#F4F6F5" },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderColor: "rgba(65, 108, 175, 0.08)",
  },
  noticeLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  offlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FF9800",
    marginRight: 6,
  },
  noticeText: {
    color: COLORS.textPrimary,
    fontWeight: "700",
    fontSize: 13,
  },
  noticeSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: "500",
  },
  field: {
    flex: 1,
    margin: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(65, 108, 175, 0.12)",
    backgroundColor: "#F0F4F1", // soft clean grid background
    overflow: "hidden",
    position: "relative",
  },
  mapGridPattern: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.06,
    borderWidth: 1,
    borderColor: "#416CAF",
    // Creates a grid effect via dashed lines
    borderStyle: "dashed",
  },
  contourRing: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "rgba(65, 108, 175, 0.04)",
    borderStyle: "solid",
  },
  compassContainer: {
    position: "absolute",
    top: 16,
    right: 16,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.8,
  },
  compassText: {
    fontSize: 10,
    fontWeight: "900",
    color: "rgba(65, 108, 175, 0.4)",
    marginTop: -2,
  },
  markerContainer: {
    position: "absolute",
    marginLeft: -18,
    marginTop: -18,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  marker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2.5,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  markerText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
  },
  markerCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  alertBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#FF0000",
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  alertBadgeText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "900",
  },
  userMarker: {
    position: "absolute",
    width: 24,
    height: 24,
    marginLeft: -12,
    marginTop: -12,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseRing: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(66, 133, 244, 0.2)",
  },
  userMarkerCore: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#fff",
    backgroundColor: "#4285F4",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  targetMarker: {
    position: "absolute",
    width: 28,
    height: 28,
    marginLeft: -14,
    marginTop: -14,
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: "#fff",
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  empty: {
    position: "absolute",
    left: 24,
    right: 24,
    top: "35%",
    alignItems: "center",
    padding: 20,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(65, 108, 175, 0.08)",
  },
  emptyTitle: { marginTop: 8, color: COLORS.textPrimary, fontSize: 14, fontWeight: "800", textAlign: "center" },
  emptyText: { marginTop: 4, color: COLORS.textSecondary, fontSize: 11, textAlign: "center", lineHeight: 16 },
});
