import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Q } from "@nozbe/watermelondb";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { COLORS } from "../../constants/colors";
import { FEATURES } from "../../constants/featureFlags";
import { GovtHeader } from "../../components/GovtHeader";
import OSMMapView from "../../components/OSMMapView";
import { OfflineFieldMap } from "../../components/OfflineFieldMap";
import { endpoints } from "../../constants/api";
import { getDatabase } from "../../database";
import { isWatermelonNativeAvailable } from "../../database/isNativeAvailable";
import { apiClient } from "../../api/client";
import { localizePair, useLocale, localizeEntry } from "../../utils/localization";
import { buildMapMarkers, buildOfflineMapPatients, MAP_MARKER_COLORS, computePatientStats } from "../../utils/mapMarkers";
import { fetchIsOnline, subscribeConnectivity } from "../../utils/connectivity";
import { logger } from "../../utils/logger";

const INITIAL_REGION = { latitude: 20.5937, longitude: 78.9629, latitudeDelta: 4, longitudeDelta: 4 };
const DEV_SIMULATOR_LOCATION = { latitude: 37.7879, longitude: -122.4075 };

function getHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const d = R * c; // in metres
  return d;
}

function formatDistance(meters, locale) {
  if (meters < 1000) {
    const formattedNum = Math.round(meters);
    if (locale === "bn") return `${formattedNum} মিটার`;
    if (locale === "hi") return `${formattedNum} मीटर`;
    return `${formattedNum} m`;
  }
  const km = (meters / 1000).toFixed(1);
  if (locale === "bn") return `${km} কিমি`;
  if (locale === "hi") return `${km} किमी`;
  return `${km} km`;
}

function formatTime(meters, locale) {
  // Walking speed approx 1.4 m/s (5 km/h)
  const seconds = meters / 1.4;
  const mins = Math.max(1, Math.round(seconds / 60));
  if (locale === "bn") return `${mins} মিনিট`;
  if (locale === "hi") return `${mins} मिनट`;
  return `${mins} mins`;
}

const FACILITY_TEMPLATES = [
  {
    id: "fac_1",
    name: {
      en: "Gopalpur Health Sub-Centre",
      hi: "गोपालपुर स्वास्थ्य उप-केंद्र",
      bn: "গোপালপুর স্বাস্থ্য উপ-কেন্দ্র",
    },
    latOffset: 0.0022,
    lngOffset: 0.0028,
    phone: "+919876543210",
    steps: [
      {
        en: "Head North-East on the main village lane.",
        hi: "मुख्य ग्राम गली पर उत्तर-पूर्व की ओर चलें।",
        bn: "প্রধান গ্রামের গলি দিয়ে উত্তর-পূর্ব দিকে এগিয়ে যান।",
      },
      {
        en: "Turn left after the community water well.",
        hi: "सामुदायिक कुएं के बाद बाएं मुड़ें।",
        bn: "সামুদায়েক কুয়োর পরে বাঁদিকে ঘুরুন।",
      },
      {
        en: "Sub-Centre is 150m ahead, right next to the school.",
        hi: "स्वास्थ्य उप-केंद्र १५० मीटर आगे स्कूल के ठीक बगल में है।",
        bn: "উপ-স্বাস্থ্য কেন্দ্রটি ১৫০ মিটার সামনে, স্কুলের ঠিক পাশে অবস্থিত।",
      },
    ],
  },
  {
    id: "fac_2",
    name: {
      en: "Village Anganwadi Centre",
      hi: "ग्राम आंगनवाड़ी केंद्र",
      bn: "গ্রাম অঙ্গনওয়াড়ি কেন্দ্র",
    },
    latOffset: -0.0016,
    lngOffset: 0.0018,
    phone: "+919876543211",
    steps: [
      {
        en: "Walk South towards the community center.",
        hi: "सामुदायिक भवन की ओर दक्षिण दिशा में चलें।",
        bn: "কমিউনিটি সেন্টারের দিকে দক্ষিণ অভিমুখে হাঁটুন।",
      },
      {
        en: "Turn right at the crossroads before Panchayat Bhawan.",
        hi: "पंचायत भवन से पहले चौराहे पर दाएं मुड़ें।",
        bn: "পঞ্চায়েত ভবনের আগে মোড়ে ডানদিকে ঘুরুন।",
      },
      {
        en: "Anganwadi will be on your left side.",
        hi: "आंगनवाड़ी केंद्र आपके बाईं ओर स्थित होगा।",
        bn: "অঙ্গনওয়াড়ি কেন্দ্রটি আপনার বাঁদিকে থাকবে।",
      },
    ],
  },
  {
    id: "fac_3",
    name: {
      en: "Primary Health Centre (PHC) Rampur",
      hi: "प्राथमिक स्वास्थ्य केंद्र रामपुर",
      bn: "রামপুর প্রাথমিক স্বাস্থ্য কেন্দ্র",
    },
    latOffset: 0.0048,
    lngOffset: -0.0035,
    phone: "+919876543212",
    steps: [
      {
        en: "Head West towards the main approach highway.",
        hi: "मुख्य एप्रोच मार्ग की ओर पश्चिम दिशा में चलें।",
        bn: "প্রধান সংযোগকারী সড়কের দিকে পশ্চিম অভিমুখে এগিয়ে যান।",
      },
      {
        en: "Merge left onto the metalled main road.",
        hi: "पक्की मुख्य सड़क पर बाईं ओर जुड़ें।",
        bn: "পাকা পিচের প্রধান রাস্তায় বাঁদিকে যোগ দিন।",
      },
      {
        en: "PHC is located on the right next to the cooperative bank.",
        hi: "सहकारी बैंक के बगल में दाईं ओर पीएचसी स्थित है।",
        bn: "প্রাথমিক স্বাস্থ্য কেন্দ্রটি সমবায় ব্যাংকের পাশে ডানদিকে অবস্থিত।",
      },
    ],
  },
];

export default function MapScreen() {
  const router = useRouter();
  const locale = useLocale();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [mapFailed, setMapFailed] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  const [activeStationIndex, setActiveStationIndex] = useState(0);
  const [recenterCount, setRecenterCount] = useState(0);
  const [activeCardTab, setActiveCardTab] = useState("directions");
  const [cardVisible, setCardVisible] = useState(true);

  const fetchMapData = useCallback(async () => {
    try {
      const { data } = await apiClient.get(`${endpoints.patients}map_data/`);
      setPatients(data.results || data || []);
      setError(null);
    } catch (e) {
      logger.info("[MapScreen] fetchMapData error; falling back offline", e?.message || e);
      if (isWatermelonNativeAvailable()) {
        try {
          const db = getDatabase();
          const patientsList = await db.collections.get("patients").query(Q.where("is_deleted", false)).fetch();
          const householdsList = await db.collections.get("households").query(Q.where("is_deleted", false)).fetch();
          setPatients(buildOfflineMapPatients(patientsList, householdsList));
          setError(null);
        } catch (dbErr) {
          logger.warn("[MapScreen] offline map data failed", dbErr?.message || dbErr);
          setError("Failed to load map data offline");
        }
      } else {
        setError(e.message || "Failed to load map data");
      }
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

  useEffect(() => {
    fetchIsOnline()
      .then(setIsOnline)
      .catch(() => setIsOnline(false));
    return subscribeConnectivity((online) => {
      setIsOnline(online);
      if (online) setMapFailed(false);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (!granted || cancelled) {
          if (__DEV__ && !cancelled) setUserLocation(DEV_SIMULATOR_LOCATION);
          return;
        }
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (!cancelled && lastKnown?.coords) {
          setUserLocation({
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
          });
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        if (!cancelled) {
          setUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      } catch (e) {
        logger.debug("[MapScreen] location unavailable", e?.message || e);
        if (__DEV__ && !cancelled) setUserLocation(DEV_SIMULATOR_LOCATION);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stations = useMemo(() => {
    if (!userLocation) return [];
    const { latitude: lat, longitude: lng } = userLocation;

    const computed = FACILITY_TEMPLATES.map((tpl) => {
      const targetLat = lat + tpl.latOffset;
      const targetLng = lng + tpl.lngOffset;
      const meters = getHaversineDistance(lat, lng, targetLat, targetLng);
      return {
        id: tpl.id,
        name: tpl.name,
        latitude: targetLat,
        longitude: targetLng,
        phone: tpl.phone,
        distance: formatDistance(meters, locale),
        time: formatTime(meters, locale),
        steps: tpl.steps,
        rawDistance: meters,
      };
    });

    // Sort by proximity
    return computed.sort((a, b) => a.rawDistance - b.rawDistance);
  }, [userLocation, locale]);

  const activeStation = stations[activeStationIndex] || null;
  const markers = useMemo(() => buildMapMarkers(patients), [patients]);
  const stats = useMemo(() => computePatientStats(patients), [patients]);
  const useFallbackMap = !isOnline || mapFailed;
  const handleMarkerPress = useCallback((id) => router.push(`/(tabs)/patients/${id}`), [router]);
  const handleMapError = useCallback((reason) => {
    logger.debug("[MapScreen] WebView map unavailable; using offline field map", reason);
    setMapFailed(true);
  }, []);

  const makeCall = (phone) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch((err) => {
        logger.warn("[MapScreen] Phone call error", err);
      });
    }
  };

  const openGoogleMaps = (station) => {
    if (station && userLocation) {
      const url = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.latitude},${userLocation.longitude}&destination=${station.latitude},${station.longitude}&travelmode=walking`;
      Linking.openURL(url).catch((err) => {
        logger.warn("[MapScreen] Google Maps link error", err);
      });
    }
  };

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
              <Text style={styles.retryText}>{localizePair("पुनः प्रयास", "Retry", locale)}</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        <>
          {useFallbackMap ? (
            <OfflineFieldMap
              markers={markers}
              userLocation={userLocation}
              routeTarget={
                activeStation
                  ? {
                      ...activeStation,
                      name: String(localizeEntry(activeStation.name, locale) || ""),
                      detail: String(
                        localizeEntry(
                          { en: "Nearest Health Post", hi: "निकटतम स्वास्थ्य केंद्र", bn: "নিকটতম স্বাস্থ্য কেন্দ্র" },
                          locale,
                        ) || "",
                      ),
                    }
                  : null
              }
              onMarkerPress={handleMarkerPress}
            />
          ) : (
            <OSMMapView
              style={styles.map}
              initialRegion={INITIAL_REGION}
              markers={markers}
              showsUserLocation
              userLocation={userLocation}
              routeTarget={
                activeStation
                  ? {
                      ...activeStation,
                      name: String(localizeEntry(activeStation.name, locale) || ""),
                      detail: String(
                        localizeEntry(
                          { en: "Nearest Health Post", hi: "निकटतम स्वास्थ्य केंद्र", bn: "নিকটতম স্বাস্থ্য কেন্দ্র" },
                          locale,
                        ) || "",
                      ),
                    }
                  : null
              }
              recenterCount={recenterCount}
              onMarkerPress={handleMarkerPress}
              onMapReady={() => setMapFailed(false)}
              onMapError={handleMapError}
            />
          )}
        </>
      )}

      {/* Show Details FAB when card is hidden */}
      {!cardVisible && (
        <Pressable
          style={styles.showCardFAB}
          onPress={() => setCardVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Show Map Details"
        >
          <Ionicons name="map" size={18} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.showCardFABTxt}>{localizeEntry({ en: "Show Details", hi: "विवरण दिखाएं", bn: "বিশদ দেখান" }, locale)}</Text>
        </Pressable>
      )}

      {/* Floating Tab Card (Directions & Legend) */}
      {cardVisible && (
        <View style={styles.cardContainer}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTabsContainer}>
              <Pressable
                style={[styles.cardTab, activeCardTab === "directions" && styles.cardTabActive]}
                onPress={() => setActiveCardTab("directions")}
              >
                <Text style={[styles.cardTabTxt, activeCardTab === "directions" && styles.cardTabTxtActive]}>
                  {localizeEntry({ en: "Directions", hi: "दिशा निर्देश", bn: "দিকনির্দেশ" }, locale)}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.cardTab, activeCardTab === "legend" && styles.cardTabActive]}
                onPress={() => setActiveCardTab("legend")}
              >
                <Text style={[styles.cardTabTxt, activeCardTab === "legend" && styles.cardTabTxtActive]}>
                  {localizeEntry({ en: "Legend", hi: "संकेत", bn: "চিহ্নসমূহ" }, locale)}
                </Text>
              </Pressable>
            </View>

            <View style={styles.cardHeaderActions}>
              <Pressable
                onPress={fetchMapData}
                style={styles.cardHeaderBtn}
                accessibilityRole="button"
                accessibilityLabel="Reload Map Data"
              >
                <Ionicons name="refresh" size={18} color={COLORS.primary} />
              </Pressable>
              <Pressable
                onPress={() => setCardVisible(false)}
                style={styles.cardHeaderBtn}
                accessibilityRole="button"
                accessibilityLabel="Close Card"
              >
                <Ionicons name="close" size={18} color={COLORS.textSecondary} />
              </Pressable>
            </View>
          </View>

          {activeCardTab === "directions" ? (
            userLocation ? (
              activeStation ? (
                <View style={styles.directionsContent}>
                  <View style={styles.stationHeader}>
                    <Ionicons name="git-branch" size={18} color={COLORS.primary} />
                    <Text style={styles.stationName} numberOfLines={1}>
                      {localizeEntry(activeStation.name, locale)}
                    </Text>

                    {/* Call Emergency Contact */}
                    <Pressable
                      onPress={() => makeCall(activeStation.phone)}
                      style={styles.circleIconBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Call Facility"
                    >
                      <Ionicons name="call" size={16} color={COLORS.primary} />
                    </Pressable>

                    {/* External Google Maps redirection */}
                    <Pressable
                      onPress={() => openGoogleMaps(activeStation)}
                      style={styles.circleIconBtn}
                      accessibilityRole="button"
                      accessibilityLabel="Open in Google Maps"
                    >
                      <Ionicons name="map" size={16} color={COLORS.primary} />
                    </Pressable>
                  </View>
                  <View style={styles.metaRow}>
                    <View style={styles.metaBadge}>
                      <Ionicons name="walk" size={14} color={COLORS.primary} />
                      <Text style={styles.metaBadgeTxt}>{activeStation.distance}</Text>
                    </View>
                    <View style={styles.metaBadge}>
                      <Ionicons name="time" size={14} color={COLORS.primary} />
                      <Text style={styles.metaBadgeTxt}>{activeStation.time}</Text>
                    </View>
                  </View>

                  <ScrollView style={styles.stepsScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {activeStation.steps.map((step, idx) => (
                      <View key={idx} style={styles.stepRow}>
                        <View style={styles.stepNumber}>
                          <Text style={styles.stepNumberTxt}>{idx + 1}</Text>
                        </View>
                        <View style={styles.stepTexts}>
                          <Text style={styles.stepHi}>{localizeEntry(step, locale)}</Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>

                  <View style={styles.actionRow}>
                    <Pressable style={styles.actionBtn} onPress={() => setActiveStationIndex((prev) => (prev + 1) % stations.length)}>
                      <Ionicons name="play-forward" size={16} color="#fff" />
                      <Text style={styles.actionBtnTxt}>
                        {localizeEntry({ en: "Next Facility", hi: "अगला केंद्र", bn: "পরবর্তী কেন্দ্র" }, locale)}
                      </Text>
                    </Pressable>
                    <Pressable style={[styles.actionBtn, styles.actionBtnOutline]} onPress={() => setRecenterCount((prev) => prev + 1)}>
                      <Ionicons name="locate" size={16} color={COLORS.primary} />
                      <Text style={[styles.actionBtnTxt, styles.actionBtnTxtOutline]}>
                        {localizeEntry({ en: "Recenter", hi: "केंद्रित करें", bn: "পুনরায় কেন্দ্রবিন্দু" }, locale)}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null
            ) : (
              <View style={styles.loadingLocation}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.loadingLocationTxt}>
                  {localizeEntry(
                    {
                      en: "Waiting for GPS location...",
                      hi: "GPS लोकेशन की प्रतीक्षा कर रहे हैं...",
                      bn: "জিপিএস অবস্থানের জন্য অপেক্ষা করা হচ্ছে...",
                    },
                    locale,
                  )}
                </Text>
              </View>
            )
          ) : (
            <View style={styles.legendContent}>
              <View style={styles.legendStatsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{stats.totalHouseholds}</Text>
                  <Text style={styles.statLbl}>{localizeEntry({ en: "Households", hi: "कुल घर", bn: "মোট বাড়ি" }, locale)}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{stats.totalPatients}</Text>
                  <Text style={styles.statLbl}>{localizeEntry({ en: "Patients", hi: "कुल लाभार्थी", bn: "মোট রোগী" }, locale)}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statVal, { color: MAP_MARKER_COLORS.pregnant }]}>{stats.pregnantCount}</Text>
                  <Text style={styles.statLbl}>{localizeEntry({ en: "Pregnant", hi: "गर्भवती", bn: "গর্ভবতী" }, locale)}</Text>
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.legendItemsScroll}>
                <View style={styles.legendItem}>
                  <View style={[styles.markerDot, { backgroundColor: MAP_MARKER_COLORS.pregnant }]} />
                  <Text style={styles.legendLabel}>
                    {localizeEntry({ en: "High Risk / Pregnant", hi: "गर्भवती महिला", bn: "গর্ভবতী মহিলা" }, locale)}
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.markerDot, { backgroundColor: MAP_MARKER_COLORS.childImmunization }]} />
                  <Text style={styles.legendLabel}>
                    {localizeEntry({ en: "Child (<5y)", hi: "बच्चा (<५ वर्ष)", bn: "শিশু (<৫ বছর)" }, locale)}
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.markerDot, { backgroundColor: MAP_MARKER_COLORS.pendingVisit }]} />
                  <Text style={styles.legendLabel}>
                    {localizeEntry({ en: "Pending Visit", hi: "बाकी दौरा", bn: "বাকি পরিদর্শন" }, locale)}
                  </Text>
                </View>
              </ScrollView>

              <View style={styles.adminNoteBox}>
                <Ionicons name="information-circle" size={14} color={COLORS.primary} style={{ marginRight: 6 }} />
                <Text style={styles.adminNoteText}>
                  {localizeEntry(
                    {
                      en: "Households are automatically updated based on your assigned village geography from the administrator.",
                      hi: "प्रशासक द्वारा आपके आवंटित ग्राम क्षेत्र के अनुसार घरों की सूची स्वतः अपडेट होती है।",
                      bn: "অ্যাডমিনিস্ট্রেটর দ্বারা আপনার বরাদ্দকৃত গ্রাম অঞ্চল অনুযায়ী বাড়িগুলি এখানে স্বয়ংক্রিয়ভাবে লোড হয়ে যায়।",
                    },
                    locale,
                  )}
                </Text>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

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
  showCardFAB: {
    position: "absolute",
    bottom: 96,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  showCardFABTxt: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
  },
  cardContainer: {
    position: "absolute",
    bottom: 96,
    left: 16,
    right: 16,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    borderWidth: 1,
    borderColor: "rgba(65, 108, 175, 0.1)",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    paddingBottom: 4,
  },
  cardTabsContainer: {
    flexDirection: "row",
    flex: 1,
  },
  cardHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardHeaderBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: COLORS.navyLight,
  },
  cardTab: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  cardTabActive: {
    borderBottomColor: COLORS.primary,
  },
  cardTabTxt: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.textSecondary,
  },
  cardTabTxtActive: {
    color: COLORS.primary,
  },
  directionsContent: {
    gap: 10,
  },
  stationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stationName: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.textPrimary,
    flex: 1,
  },
  circleIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.navyLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(65, 108, 175, 0.15)",
  },
  metaRow: {
    flexDirection: "row",
    gap: 12,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.navyLight,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 4,
  },
  metaBadgeTxt: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.primary,
  },
  stepsScroll: {
    maxHeight: 110,
  },
  stepRow: {
    flexDirection: "row",
    gap: 8,
    marginVertical: 6,
    alignItems: "flex-start",
  },
  stepNumber: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  stepNumberTxt: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "900",
  },
  stepTexts: {
    flex: 1,
    gap: 2,
  },
  stepHi: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textPrimary,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 6,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    height: 38,
    gap: 6,
  },
  actionBtnOutline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  actionBtnTxt: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  actionBtnTxtOutline: {
    color: COLORS.primary,
  },
  loadingLocation: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 8,
  },
  loadingLocationTxt: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  legendContent: {
    paddingVertical: 4,
    gap: 10,
  },
  legendStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: COLORS.navyLight,
    borderRadius: 12,
    padding: 10,
  },
  statBox: {
    alignItems: "center",
    flex: 1,
  },
  statVal: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.primary,
  },
  statLbl: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  legendItemsScroll: {
    paddingVertical: 4,
    gap: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginRight: 4,
  },
  legendLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: "600",
  },
  markerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  adminNoteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FFF9E6",
    borderWidth: 1,
    borderColor: "#FFEAA8",
    borderRadius: 10,
    padding: 10,
  },
  adminNoteText: {
    flex: 1,
    fontSize: 10.5,
    color: "#856404",
    lineHeight: 15,
    fontWeight: "500",
  },
});
