from rest_framework import serializers

from .models import FollowUp, VisitRecord


class FollowUpSerializer(serializers.ModelSerializer):
    class Meta:
        model = FollowUp
        fields = [
            "id",
            "local_uuid",
            "patient",
            "worker",
            "scheduled_date",
            "urgency",
            "triggered_by_assessment",
            "is_auto_scheduled",
            "status",
            "completed_at",
            "completion_notes",
            "incentive_claimed",
            "visit_lat",
            "visit_lng",
            "visit_accuracy_m",
            "visit_gps_timestamp",
            "distance_from_household_m",
            "gps_verification_status",
            "visit_otp_verified",
            "visit_otp_bypassed",
            "bypass_reason",
            "created_at",
        ]
        read_only_fields = ["id", "local_uuid", "created_at", "updated_at"]


class VisitRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = VisitRecord
        fields = [
            "id",
            "local_uuid",
            "patient",
            "worker",
            "follow_up",
            "visit_date",
            "visit_time",
            "condition_observed",
            "notes",
            "next_visit_date",
            "referred_to_phc",
            "referral_facility",
            "visit_lat",
            "visit_lng",
            "visit_accuracy_m",
            "visit_gps_timestamp",
            "distance_from_household_m",
            "gps_verification_status",
            "created_at",
        ]
        read_only_fields = ["id", "local_uuid", "created_at", "updated_at"]
