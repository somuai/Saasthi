from registry.models import Patient
from rest_framework import serializers

from .models import (
    ANCVisit,
    CareInteraction,
    DeliveryRecord,
    DevelopmentMilestoneCheck,
    GrowthRecord,
    IFACompliance,
    ImmunizationRecord,
    MCPSurveySession,
    PNCVisit,
)


class PatientLocalUuidMixin(serializers.ModelSerializer):
    patient_local_uuid = serializers.UUIDField(write_only=True, required=False)

    def validate(self, attrs):
        patient_uuid = attrs.pop("patient_local_uuid", None)
        if patient_uuid:
            attrs["patient"] = Patient.objects.get(local_uuid=patient_uuid)
        return attrs


class CareInteractionSerializer(PatientLocalUuidMixin):
    class Meta:
        model = CareInteraction
        fields = ['id', 'local_uuid', 'patient', 'protocol', 'notes', 'occurred_at', 'payload', 'created_by', 'created_at', 'updated_at', 'patient_local_uuid']
        read_only_fields = ["id", "created_by", "created_at", "updated_at"]
        extra_kwargs = {"patient": {"required": False}}


class ANCVisitSerializer(PatientLocalUuidMixin):
    class Meta:
        model = ANCVisit
        fields = [
            'id', 'local_uuid', 'patient', 'asha_worker', 'visit_number', 'visit_date',
            'pog_weeks', 'weight_kg', 'pulse_rate', 'bp_systolic', 'bp_diastolic',
            'pallor', 'oedema', 'jaundice', 'any_complaints', 'fundal_height_cm',
            'lie_presentation', 'fetal_movements', 'fetal_heart_rate', 'pv_done',
            'hemoglobin_gms', 'urine_albumin', 'urine_sugar', 'hiv_screening',
            'syphilis_test', 'ultrasonography', 'gdm_screening', 'blood_group',
            'rh_typing', 'tsh_value', 'hbsag', 'blood_sugar_value', 'tt_injection_given',
            'ifa_tablets_given', 'calcium_tablets_given', 'albendazole_given',
            'is_high_risk', 'risk_flags_summary', 'created_at', 'updated_at',
            'patient_local_uuid',
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"patient": {"required": False}, "asha_worker": {"required": False}}


class DeliveryRecordSerializer(serializers.ModelSerializer):
    mother_patient_local_uuid = serializers.UUIDField(write_only=True, required=False)
    child_patient_local_uuid = serializers.UUIDField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = DeliveryRecord
        fields = [
            'id', 'local_uuid', 'mother_patient', 'asha_worker', 'delivery_date',
            'delivery_place', 'institution_name', 'delivery_type', 'delivery_outcome',
            'baby_sex', 'birth_weight_kg', 'birth_weight_grams', 'baby_cried_immediately',
            'breastfeed_within_1hr', 'vitamin_k_given', 'complications', 'ifa_postnatal_started',
            'calcium_postnatal_started', 'child_patient', 'institution_stay_days',
            'jsy_registered', 'pmmvy_registered', 'created_at', 'updated_at',
            'mother_patient_local_uuid', 'child_patient_local_uuid'
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {
            "mother_patient": {"required": False},
            "asha_worker": {"required": False},
            "child_patient": {"required": False},
        }

    def validate(self, attrs):
        mother_uuid = attrs.pop("mother_patient_local_uuid", None)
        if mother_uuid:
            attrs["mother_patient"] = Patient.objects.get(local_uuid=mother_uuid)
        child_uuid = attrs.pop("child_patient_local_uuid", None)
        if child_uuid:
            attrs["child_patient"] = Patient.objects.get(local_uuid=child_uuid)
        return attrs


class PNCVisitSerializer(serializers.ModelSerializer):
    mother_patient_local_uuid = serializers.UUIDField(write_only=True, required=False)

    class Meta:
        model = PNCVisit
        fields = [
            'id', 'local_uuid', 'mother_patient', 'delivery_record', 'asha_worker',
            'visit_timing', 'visit_date', 'mother_complaints', 'mother_pallor',
            'mother_pulse', 'mother_bp_sys', 'mother_bp_dia', 'mother_temp_f',
            'breasts_condition', 'nipples_condition', 'uterus_tenderness', 'bleeding_pv',
            'lochia', 'episiotomy', 'family_planning_counselled', 'baby_weight_kg',
            'baby_urine', 'baby_stool', 'baby_diarrhoea', 'baby_vomiting', 'baby_convulsions',
            'baby_activity', 'baby_sucking', 'baby_breathing', 'baby_chest_indrawing',
            'baby_temp_f', 'baby_jaundice', 'umbilical_stump', 'is_extra_visit',
            'created_at', 'updated_at', 'mother_patient_local_uuid'
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {
            "mother_patient": {"required": False},
            "asha_worker": {"required": False},
            "delivery_record": {"required": False},
        }

    def validate(self, attrs):
        mother_uuid = attrs.pop("mother_patient_local_uuid", None)
        if mother_uuid:
            attrs["mother_patient"] = Patient.objects.get(local_uuid=mother_uuid)
        return attrs


class GrowthRecordSerializer(PatientLocalUuidMixin):
    class Meta:
        model = GrowthRecord
        fields = [
            'id', 'local_uuid', 'patient', 'asha_worker', 'recorded_date', 'recorded_by',
            'age_completed_months', 'weight_kg', 'height_cm', 'muac_cm', 'wfa_z_score',
            'wfh_z_score', 'hfa_z_score', 'nutritional_status', 'weight_change_kg',
            'is_faltering', 'aww_notes', 'created_at', 'updated_at',
            'patient_local_uuid',
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"patient": {"required": False}, "asha_worker": {"required": False}}


class DevelopmentMilestoneCheckSerializer(PatientLocalUuidMixin):
    class Meta:
        model = DevelopmentMilestoneCheck
        fields = [
            'id', 'local_uuid', 'patient', 'asha_worker', 'check_date',
            'age_at_check_months', 'milestones_achieved', 'warning_signs',
            'any_warning_sign', 'developmental_concern', 'referred_to',
            'created_at', 'updated_at', 'patient_local_uuid',
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"patient": {"required": False}, "asha_worker": {"required": False}}


class ImmunizationRecordSerializer(PatientLocalUuidMixin):
    class Meta:
        model = ImmunizationRecord
        fields = [
            'id', 'local_uuid', 'patient', 'asha_worker', 'vaccine_name', 'dose_number',
            'scheduled_date', 'administered_date', 'administered_at', 'status',
            'missed_reason', 'next_reschedule', 'fic_eligible', 'cic_eligible',
            'is_vitamin_a', 'vitamin_a_dose_num', 'created_at', 'updated_at',
            'patient_local_uuid',
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"patient": {"required": False}, "asha_worker": {"required": False}}


class IFAComplianceSerializer(PatientLocalUuidMixin):
    class Meta:
        model = IFACompliance
        fields = [
            'id', 'local_uuid', 'patient', 'asha_worker', 'record_date', 'year_month',
            'week_number', 'dose_given', 'dose_day', 'bottle_number', 'albendazole_given',
            'created_at', 'updated_at', 'patient_local_uuid',
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"patient": {"required": False}, "asha_worker": {"required": False}}


class MCPSurveySessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MCPSurveySession
        fields = [
            'id', 'local_uuid', 'patient', 'asha_worker', 'session_date',
            'session_type', 'linked_record_id', 'linked_record_type',
            'risk_assessment', 'created_at', 'updated_at'
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
