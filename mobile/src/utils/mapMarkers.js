/**
 * Map marker utilities for Saasthi ASHA worker field map.
 *
 * Markers now represent *households* rather than individual patients,
 * colour-coded by visit priority (pregnant women, children due for immunization,
 * general pending visits, already visited).
 */

// Priority-based marker colours (highest priority wins)
export const MAP_MARKER_COLORS = {
  pregnant: "#E91E63", // Magenta-pink — pregnant women (highest priority)
  childImmunization: "#FF9800", // Orange — children under 5 (immunization due)
  pendingVisit: "#FFC107", // Amber — pending visit
  visited: "#4CAF50", // Green — visited this week
  facility: "#EF4444", // Red — health facilities
  unknown: "#9E9E9E", // Grey fallback
};

// Legacy alias for backward compat (used nowhere now, kept for safety)
export const MAP_GENDER_COLORS = {
  female: MAP_MARKER_COLORS.pregnant,
  male: MAP_MARKER_COLORS.pendingVisit,
  other: "#9C27B0",
  unknown: MAP_MARKER_COLORS.unknown,
};

function finiteCoordinate(value, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < min || num > max) return null;
  return num;
}

/**
 * Determine the priority colour for a patient based on health context.
 */
function patientPriorityColor(patient) {
  if (patient?.is_pregnant || patient?.isPregnant) return MAP_MARKER_COLORS.pregnant;
  if (patient?.age != null && Number(patient.age) < 5) return MAP_MARKER_COLORS.childImmunization;
  return MAP_MARKER_COLORS.pendingVisit;
}

/**
 * Build a single marker from a patient record (legacy per-patient approach).
 */
export function mapPatientToMarker(patient) {
  const latitude = finiteCoordinate(patient?.household_lat ?? patient?.latitude, -90, 90);
  const longitude = finiteCoordinate(patient?.household_lng ?? patient?.longitude, -180, 180);
  const id = patient?.local_uuid || patient?.localUuid || patient?.id;

  if (!id || latitude == null || longitude == null) return null;

  return {
    id: String(id),
    latitude,
    longitude,
    title: patient?.full_name || patient?.name || "Patient",
    subtitle: patient?.village || "",
    color: patientPriorityColor(patient),
    isPregnant: !!(patient?.is_pregnant || patient?.isPregnant),
    isChild: patient?.age != null && Number(patient.age) < 5,
    gender: patient?.gender || "unknown",
  };
}

/**
 * Group patients by household GPS (within ~10m grid), producing one marker
 * per household cluster.  The marker colour = highest-priority resident.
 */
export function buildMapMarkers(patients) {
  const raw = (patients || []).map(mapPatientToMarker).filter(Boolean);

  // Group by a coarse lat/lng grid (≈ 11 m)
  const grid = {};
  raw.forEach((m) => {
    const key = `${m.latitude.toFixed(4)}|${m.longitude.toFixed(4)}`;
    if (!grid[key]) {
      grid[key] = {
        latitude: m.latitude,
        longitude: m.longitude,
        patients: [],
        village: m.subtitle || "",
      };
    }
    grid[key].patients.push(m);
  });

  return Object.entries(grid).map(([, cluster]) => {
    const { patients: pts, latitude, longitude, village } = cluster;
    const pregnantCount = pts.filter((p) => p.isPregnant).length;
    const childCount = pts.filter((p) => p.isChild).length;

    // Determine highest-priority colour
    let color = MAP_MARKER_COLORS.pendingVisit;
    if (pregnantCount > 0) color = MAP_MARKER_COLORS.pregnant;
    else if (childCount > 0) color = MAP_MARKER_COLORS.childImmunization;

    const firstPatient = pts[0];
    return {
      id: firstPatient.id,
      latitude,
      longitude,
      title: pts.length === 1 ? firstPatient.title : `${pts.length} patients`,
      subtitle: village,
      color,
      patientCount: pts.length,
      pregnantCount,
      childCount,
    };
  });
}

/**
 * Build patient list from offline WatermelonDB records (households + patients).
 */
export function buildOfflineMapPatients(patientsList, householdsList) {
  const householdMap = {};
  (householdsList || []).forEach((household) => {
    householdMap[household.id] = {
      gpsLat: household.gpsLat,
      gpsLng: household.gpsLng,
      village: household.village,
    };
  });

  return (patientsList || []).map((patient) => {
    const household = householdMap[patient.householdId] || {};
    return {
      id: patient.id,
      full_name: patient.name,
      gender: patient.gender,
      is_pregnant: patient.isPregnant,
      age: patient.age,
      household_lat: household.gpsLat,
      household_lng: household.gpsLng,
      village: household.village,
    };
  });
}

/**
 * Compute summary stats from a patient list for the legend.
 */
export function computePatientStats(patients) {
  const list = patients || [];
  let totalHouseholds = 0;
  let pregnantCount = 0;
  let childCount = 0;
  let totalPatients = list.length;

  // Count unique households (by lat/lng grid)
  const seen = new Set();
  list.forEach((p) => {
    const lat = finiteCoordinate(p?.household_lat ?? p?.latitude, -90, 90);
    const lng = finiteCoordinate(p?.household_lng ?? p?.longitude, -180, 180);
    if (lat != null && lng != null) {
      seen.add(`${lat.toFixed(4)}|${lng.toFixed(4)}`);
    }
    if (p?.is_pregnant || p?.isPregnant) pregnantCount++;
    if (p?.age != null && Number(p.age) < 5) childCount++;
  });
  totalHouseholds = seen.size;

  return { totalPatients, totalHouseholds, pregnantCount, childCount };
}
