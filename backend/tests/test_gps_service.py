from django.test.utils import override_settings
from followups.services.gps_service import classify_gps_visit, haversine_distance_m


class TestHaversineDistance:
    def test_same_point_zero_distance(self):
        d = haversine_distance_m(28.6139, 77.2090, 28.6139, 77.2090)
        assert d < 1

    def test_delhi_to_mumbai_approx(self):
        d = haversine_distance_m(28.6139, 77.2090, 19.0760, 72.8777)
        assert 1100_000 < d < 1200_000

    def test_equator_1_degree(self):
        d = haversine_distance_m(0, 0, 0, 1)
        assert 110_000 < d < 112_000

    def test_commutative(self):
        d1 = haversine_distance_m(12.34, 56.78, 23.45, 67.89)
        d2 = haversine_distance_m(23.45, 67.89, 12.34, 56.78)
        assert abs(d1 - d2) < 0.1


class TestClassifyGpsVisit:
    def test_no_household_gps(self):
        result = classify_gps_visit(28.6, 77.2, None, None, 10.0)
        assert result["status"] == "no_household_gps"
        assert result["distance_m"] is None

    def test_within_radius(self):
        lat, lng = 28.6139, 77.2090
        result = classify_gps_visit(lat + 0.001, lng + 0.001, lat, lng, 50.0)
        assert result["status"] == "within_radius"
        assert result["distance_m"] < 200
        assert result["accuracy_m"] == 50.0

    def test_warning_zone(self):
        lat, lng = 28.6139, 77.2090
        result = classify_gps_visit(lat + 0.003, lng + 0.003, lat, lng, 10.0)
        assert result["status"] == "warning_zone"

    @override_settings(GPS_ACCEPTABLE_RADIUS_M=100, GPS_WARNING_RADIUS_M=300)
    def test_outside_radius_with_custom_settings(self):
        lat, lng = 28.6139, 77.2090
        result = classify_gps_visit(lat + 0.005, lng + 0.005, lat, lng, 10.0)
        assert result["status"] == "outside_radius"

    @override_settings(GPS_ACCEPTABLE_RADIUS_M=100)
    def test_warning_zone_with_custom_acceptable(self):
        lat, lng = 28.6139, 77.2090
        result = classify_gps_visit(lat + 0.001, lng + 0.001, lat, lng, 10.0)
        assert result["status"] == "warning_zone"

    def test_accuracy_adjustment(self):
        lat, lng = 28.6139, 77.2090
        result_high_accuracy = classify_gps_visit(lat + 0.002, lng + 0.002, lat, lng, 200.0)
        result_low_accuracy = classify_gps_visit(lat + 0.002, lng + 0.002, lat, lng, 10.0)
        assert result_high_accuracy["status"] == "within_radius"
        assert result_low_accuracy["status"] == "warning_zone"
