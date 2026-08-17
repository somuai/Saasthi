from accounts.models import User, WorkerRegistration
from flagging.models import Flag
from incentives.models import IncentiveLedgerEntry
from mcp.models import (
    ANCVisit,
    CareInteraction,
    DeliveryRecord,
    DevelopmentMilestoneCheck,
    GrowthRecord,
    ImmunizationRecord,
    PNCVisit,
)
from referrals.models import Referral
from registry.models import Household, Patient
from rest_framework import serializers
from surveys.models import SurveyResponse


class SummarySerializer(serializers.Serializer):
    total_patients = serializers.IntegerField()
    active_patients = serializers.IntegerField()
    pregnant = serializers.IntegerField()
    high_risk = serializers.IntegerField()
    open_flags = serializers.IntegerField()
    total_referrals = serializers.IntegerField()
    pending_referrals = serializers.IntegerField()
    total_ashas = serializers.IntegerField()
    registered_ashas = serializers.IntegerField()
    flags_by_severity = serializers.ListField()
    referrals_by_status = serializers.ListField()


class PatientListSerializer(serializers.ModelSerializer):
    asha_worker_name = serializers.SerializerMethodField()
    asha_worker_phone = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = [
            "id",
            "local_uuid",
            "full_name",
            "phone",
            "village",
            "block",
            "district",
            "status",
            "pregnancy_status",
            "is_high_risk_pregnancy",
            "asha_worker",
            "asha_worker_name",
            "asha_worker_phone",
            "created_at",
            "updated_at",
        ]

    def get_asha_worker_name(self, obj):
        if obj.asha_worker:
            return obj.asha_worker.get_full_name() or obj.asha_worker.first_name or obj.asha_worker.phone
        return None

    def get_asha_worker_phone(self, obj):
        return obj.asha_worker.phone if obj.asha_worker else None


class DashboardHouseholdSerializer(serializers.ModelSerializer):
    class Meta:
        model = Household
        fields = [
            "id",
            "local_uuid",
            "household_code",
            "head_name",
            "head_name_hi",
            "member_count",
            "village",
            "block",
            "district",
            "region",
            "address",
            "lat",
            "lng",
        ]


class PatientDetailSerializer(serializers.ModelSerializer):
    asha_worker_name = serializers.SerializerMethodField()
    household_code = serializers.SerializerMethodField()
    household_details = serializers.SerializerMethodField()
    household_members = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = [
            "id",
            "local_uuid",
            "full_name",
            "name_hi",
            "phone",
            "gender",
            "date_of_birth",
            "relationship_to_head",
            "village",
            "block",
            "district",
            "region",
            "status",
            "pregnancy_status",
            "is_high_risk_pregnancy",
            "asha_worker",
            "asha_worker_name",
            "household_code",
            "household_details",
            "household_members",
            "lmp_date",
            "edd",
            "blood_group",
            "rh_typing",
            "gravida",
            "para",
            "abortions",
            "last_delivery_date",
            "last_delivery_place",
            "obstetric_complications",
            "mcp_card_issued",
            "mcp_card_number",
            "mcts_rch_id",
            "diabetes",
            "hypertension",
            "tb_history",
            "anc_visit_count",
            "created_at",
            "updated_at",
        ]

    def get_asha_worker_name(self, obj):
        if obj.asha_worker:
            return obj.asha_worker.get_full_name() or obj.asha_worker.first_name or obj.asha_worker.phone
        return None

    def get_household_code(self, obj):
        return obj.household.household_code if obj.household else None

    def get_household_details(self, obj):
        if obj.household:
            return DashboardHouseholdSerializer(obj.household).data
        return None

    def get_household_members(self, obj):
        if obj.household:
            members = Patient.objects.filter(household=obj.household).exclude(id=obj.id)
            return [
                {
                    "id": m.id,
                    "full_name": m.full_name,
                    "gender": m.gender,
                    "relationship_to_head": m.relationship_to_head,
                    "pregnancy_status": m.pregnancy_status,
                    "status": m.status,
                }
                for m in members
            ]
        return []


class CareInteractionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CareInteraction
        fields = ["id", "local_uuid", "protocol", "notes", "payload", "occurred_at", "created_at"]


class ANCVisitSerializer(serializers.ModelSerializer):
    class Meta:
        model = ANCVisit
        fields = [
            "id",
            "local_uuid",
            "visit_number",
            "visit_date",
            "pog_weeks",
            "weight_kg",
            "pulse_rate",
            "bp_systolic",
            "bp_diastolic",
            "pallor",
            "oedema",
            "jaundice",
            "any_complaints",
            "fundal_height_cm",
            "lie_presentation",
            "fetal_movements",
            "fetal_heart_rate",
            "hemoglobin_gms",
            "urine_albumin",
            "urine_sugar",
            "hiv_screening",
            "syphilis_test",
            "ultrasonography",
            "gdm_screening",
            "blood_group",
            "rh_typing",
            "tsh_value",
            "hbsag",
            "blood_sugar_value",
            "tt_injection_given",
            "ifa_tablets_given",
            "calcium_tablets_given",
            "albendazole_given",
            "is_high_risk",
            "risk_flags_summary",
            "created_at",
            "updated_at",
        ]


class DeliveryRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryRecord
        fields = [
            "id",
            "local_uuid",
            "delivery_date",
            "delivery_place",
            "institution_name",
            "delivery_type",
            "delivery_outcome",
            "baby_sex",
            "birth_weight_kg",
            "birth_weight_grams",
            "baby_cried_immediately",
            "breastfeed_within_1hr",
            "vitamin_k_given",
            "complications",
            "ifa_postnatal_started",
            "calcium_postnatal_started",
            "institution_stay_days",
            "jsy_registered",
            "pmmvy_registered",
            "created_at",
            "updated_at",
        ]


class PNCVisitSerializer(serializers.ModelSerializer):
    class Meta:
        model = PNCVisit
        fields = [
            "id",
            "local_uuid",
            "visit_timing",
            "visit_date",
            "mother_complaints",
            "mother_pallor",
            "mother_pulse",
            "mother_bp_sys",
            "mother_bp_dia",
            "mother_temp_f",
            "breasts_condition",
            "nipples_condition",
            "uterus_tenderness",
            "bleeding_pv",
            "lochia",
            "episiotomy",
            "family_planning_counselled",
            "baby_weight_kg",
            "baby_urine",
            "baby_stool",
            "baby_diarrhoea",
            "baby_vomiting",
            "baby_convulsions",
            "baby_activity",
            "baby_sucking",
            "baby_breathing",
            "baby_chest_indrawing",
            "baby_temp_f",
            "baby_jaundice",
            "umbilical_stump",
            "is_extra_visit",
            "created_at",
            "updated_at",
        ]


class GrowthRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = GrowthRecord
        fields = [
            "id",
            "local_uuid",
            "recorded_date",
            "age_completed_months",
            "weight_kg",
            "height_cm",
            "muac_cm",
            "wfa_z_score",
            "wfh_z_score",
            "hfa_z_score",
            "nutritional_status",
            "weight_change_kg",
            "is_faltering",
            "created_at",
            "updated_at",
        ]


class ImmunizationRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImmunizationRecord
        fields = [
            "id",
            "local_uuid",
            "vaccine_name",
            "dose_number",
            "scheduled_date",
            "administered_date",
            "administered_at",
            "status",
            "missed_reason",
            "next_reschedule",
            "fic_eligible",
            "cic_eligible",
            "is_vitamin_a",
            "vitamin_a_dose_num",
            "created_at",
            "updated_at",
        ]


class DevelopmentMilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = DevelopmentMilestoneCheck
        fields = [
            "id",
            "local_uuid",
            "check_date",
            "age_at_check_months",
            "milestones_achieved",
            "warning_signs",
            "any_warning_sign",
            "developmental_concern",
            "referred_to",
            "created_at",
            "updated_at",
        ]


class SurveyResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = SurveyResponse
        fields = [
            "id",
            "local_uuid",
            "survey_type",
            "answers",
            "submitted_at",
            "score_snapshot",
            "photo_base64",
            "created_at",
            "updated_at",
        ]


class PatientWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = [
            "full_name",
            "phone",
            "gender",
            "date_of_birth",
            "village",
            "block",
            "district",
            "region",
            "status",
            "pregnancy_status",
            "asha_worker",
            "household",
            "lmp_date",
            "edd",
            "blood_group",
            "rh_typing",
        ]

    def create(self, validated_data):
        validated_data.setdefault("status", "active")
        return super().create(validated_data)


class ASHAListSerializer(serializers.ModelSerializer):
    patients_count = serializers.IntegerField(read_only=True)
    has_registration = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "phone",
            "village",
            "block",
            "district",
            "requires_review",
            "is_active",
            "last_login",
            "patients_count",
            "has_registration",
        ]

    def get_has_registration(self, obj):
        return WorkerRegistration.objects.filter(phone=obj.phone, is_active=True).exists()


class ASHADetailSerializer(serializers.ModelSerializer):
    patients = serializers.SerializerMethodField()
    incentives = serializers.SerializerMethodField()
    registration = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "first_name",
            "last_name",
            "phone",
            "village",
            "block",
            "district",
            "region",
            "requires_review",
            "is_active",
            "last_login",
            "patients",
            "incentives",
            "registration",
        ]

    def get_patients(self, obj):
        qs = obj.assigned_patients.all()[:50]
        return PatientListSerializer(qs, many=True).data

    def get_incentives(self, obj):
        qs = obj.incentive_entries.all().order_by("-created_at")[:20]
        return IncentiveEntrySerializer(qs, many=True).data

    def get_registration(self, obj):
        reg = WorkerRegistration.objects.filter(phone=obj.phone, is_active=True).first()
        if reg:
            return {
                "id": reg.pk,
                "full_name": reg.full_name,
                "supervisor": reg.supervisor_id,
                "is_active": reg.is_active,
            }
        return None


class IncentiveEntrySerializer(serializers.ModelSerializer):
    worker_name = serializers.SerializerMethodField()
    worker_phone = serializers.SerializerMethodField()

    class Meta:
        model = IncentiveLedgerEntry
        fields = [
            "id",
            "activity_type",
            "amount",
            "amount_paise",
            "status",
            "month_year",
            "description",
            "worker",
            "worker_name",
            "worker_phone",
            "approved_at",
            "paid_at",
            "created_at",
        ]

    def get_worker_name(self, obj):
        if obj.worker:
            return obj.worker.get_full_name() or obj.worker.first_name or obj.worker.phone
        return None

    def get_worker_phone(self, obj):
        return obj.worker.phone if obj.worker else None


class IncentiveListSerializer(IncentiveEntrySerializer):
    pass


class FlagListSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()

    class Meta:
        model = Flag
        fields = [
            "id",
            "local_uuid",
            "flag_type",
            "source",
            "severity",
            "status",
            "patient",
            "patient_name",
            "score",
            "created_at",
            "updated_at",
        ]

    def get_patient_name(self, obj):
        return obj.patient.full_name if obj.patient else None


class FlagUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Flag
        fields = ["status"]


class ReferralListSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()

    class Meta:
        model = Referral
        fields = [
            "id",
            "local_uuid",
            "patient",
            "patient_name",
            "destination",
            "reason",
            "status",
            "created_at",
            "updated_at",
        ]

    def get_patient_name(self, obj):
        return obj.patient.full_name if obj.patient else None


class ReferralUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Referral
        fields = ["status"]


class ActivitySerializer(serializers.Serializer):
    type = serializers.CharField()
    description = serializers.CharField()
    timestamp = serializers.DateTimeField()
    resource_id = serializers.IntegerField()
    resource_type = serializers.CharField()
