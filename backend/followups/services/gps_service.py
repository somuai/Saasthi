import math

from django.conf import settings


def haversine_distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def classify_gps_visit(
    visit_lat: float, visit_lng: float, household_lat: float | None, household_lng: float | None, accuracy_m: float
) -> dict:
    if household_lat is None or household_lng is None:
        return {"status": "no_household_gps", "distance_m": None}
    distance = haversine_distance_m(visit_lat, visit_lng, household_lat, household_lng)
    effective = max(0.0, distance - accuracy_m)
    acceptable = settings.GPS_ACCEPTABLE_RADIUS_M
    warning = settings.GPS_WARNING_RADIUS_M
    if effective <= acceptable:
        status = "within_radius"
    elif effective <= warning:
        status = "warning_zone"
    else:
        status = "outside_radius"
    return {"distance_m": round(distance, 1), "status": status, "accuracy_m": accuracy_m}
