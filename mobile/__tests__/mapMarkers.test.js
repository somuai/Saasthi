import { buildMapMarkers, buildOfflineMapPatients, MAP_MARKER_COLORS } from "../src/utils/mapMarkers";

describe("map marker normalization", () => {
  it("uses local_uuid from API rows for profile navigation and priority color", () => {
    const markers = buildMapMarkers([
      {
        id: 42,
        local_uuid: "patient-local-uuid",
        full_name: "Sunita Devi",
        is_pregnant: true, // Pregnant triggers MAP_MARKER_COLORS.pregnant
        household_lat: "20.5",
        household_lng: 78.9,
        village: "Bagbera",
      },
    ]);

    expect(markers).toEqual([
      expect.objectContaining({
        id: "patient-local-uuid",
        latitude: 20.5,
        longitude: 78.9,
        title: "Sunita Devi",
        subtitle: "Bagbera",
        color: MAP_MARKER_COLORS.pregnant,
      }),
    ]);
  });

  it("keeps local WatermelonDB patient ids for offline rows and uses pending color for normal", () => {
    const localRows = buildOfflineMapPatients(
      [{ id: "local-patient-id", name: "Raju", gender: "male", householdId: "house-1" }],
      [{ id: "house-1", gpsLat: 21.1, gpsLng: 79.2, village: "Gopalpur" }],
    );

    expect(buildMapMarkers(localRows)[0]).toEqual(
      expect.objectContaining({
        id: "local-patient-id",
        title: "Raju",
        latitude: 21.1,
        longitude: 79.2,
        color: MAP_MARKER_COLORS.pendingVisit,
      }),
    );
  });

  it("excludes rows with missing or invalid coordinates", () => {
    const markers = buildMapMarkers([
      { id: "missing-lat", household_lng: 78.9 },
      { id: "bad-lat", household_lat: 120, household_lng: 78.9 },
      { id: "bad-lng", household_lat: 20.5, household_lng: 200 },
      { id: "valid", household_lat: 20.5, household_lng: 78.9 },
    ]);

    expect(markers).toHaveLength(1);
    expect(markers[0].id).toBe("valid");
  });

  it("assigns priority colors properly: pregnant > child > pending", () => {
    const markers = buildMapMarkers([
      { id: "p1", is_pregnant: true, household_lat: 20.5, household_lng: 78.9 },
      { id: "p2", age: 3, household_lat: 20.6, household_lng: 78.9 },
      { id: "p3", age: 40, household_lat: 20.7, household_lng: 78.9 },
    ]);

    // Pregnant marker
    expect(markers.find(m => m.id === "p1").color).toBe(MAP_MARKER_COLORS.pregnant);
    // Under 5 child marker
    expect(markers.find(m => m.id === "p2").color).toBe(MAP_MARKER_COLORS.childImmunization);
    // Adult normal patient marker
    expect(markers.find(m => m.id === "p3").color).toBe(MAP_MARKER_COLORS.pendingVisit);
  });
});
