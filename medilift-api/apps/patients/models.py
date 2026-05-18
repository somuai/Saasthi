from django.db import models


class SyncableModel(models.Model):
    """Mirrors WatermelonDB base columns; `id` is the device-local UUID."""

    id = models.CharField(max_length=36, primary_key=True)
    server_id = models.CharField(max_length=36, blank=True, null=True)
    is_synced = models.BooleanField(default=True)
    created_at = models.BigIntegerField()
    updated_at = models.BigIntegerField()
    is_deleted = models.BooleanField(default=False)
    is_mock = models.BooleanField(default=False)

    class Meta:
        abstract = True


class Household(SyncableModel):
    household_code = models.CharField(max_length=64, blank=True, default="")
    head_of_family = models.CharField(max_length=128, blank=True, default="")
    address = models.TextField(blank=True, null=True)
    village = models.CharField(max_length=128, blank=True, null=True)
    block = models.CharField(max_length=128, blank=True, null=True)
    district = models.CharField(max_length=128, blank=True, null=True)
    gps_lat = models.FloatField(blank=True, null=True)
    gps_lng = models.FloatField(blank=True, null=True)
    total_members = models.IntegerField(blank=True, null=True)
    male_count = models.IntegerField(blank=True, null=True)
    female_count = models.IntegerField(blank=True, null=True)
    children_under5 = models.IntegerField(blank=True, null=True)
    elderly_above60 = models.IntegerField(blank=True, null=True)
    has_toilet = models.BooleanField(blank=True, null=True)
    water_source = models.CharField(max_length=64, blank=True, null=True)
    is_bpl = models.BooleanField(blank=True, null=True)
    awc_number = models.CharField(max_length=64, blank=True, null=True)
    lgd_code = models.CharField(max_length=64, blank=True, null=True)
    asha_worker_id = models.CharField(max_length=36, blank=True, null=True, db_index=True)

    class Meta:
        db_table = "households"


class Patient(SyncableModel):
    patient_code = models.CharField(max_length=64, blank=True, default="")
    household_id = models.CharField(max_length=36, blank=True, null=True)
    name = models.CharField(max_length=128, blank=True, default="")
    age = models.IntegerField(blank=True, null=True)
    gender = models.CharField(max_length=8, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    aadhaar_last4 = models.CharField(max_length=4, blank=True, null=True)
    has_diabetes = models.BooleanField(blank=True, null=True)
    has_hypertension = models.BooleanField(blank=True, null=True)
    has_tb = models.BooleanField(blank=True, null=True)
    has_asthma = models.BooleanField(blank=True, null=True)
    has_heart_disease = models.BooleanField(blank=True, null=True)
    is_pregnant = models.BooleanField(blank=True, null=True)
    hospitalized_last_year = models.BooleanField(blank=True, null=True)
    regular_medicines = models.BooleanField(blank=True, null=True)
    medicines_name = models.TextField(blank=True, null=True)
    risk_score = models.FloatField(blank=True, null=True)
    risk_level = models.CharField(max_length=16, blank=True, null=True)
    last_visited = models.CharField(max_length=32, blank=True, null=True)
    asha_worker_server_id = models.CharField(max_length=36, blank=True, null=True, db_index=True)
    date_of_birth = models.CharField(max_length=32, blank=True, null=True)
    immunization_defaulter = models.BooleanField(blank=True, null=True)
    latest_weight_for_age_z = models.FloatField(blank=True, null=True)

    class Meta:
        db_table = "patients"


class MotherRecord(SyncableModel):
    patient_id = models.CharField(max_length=36, db_index=True)
    payload_json = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "mother_records"


class AncVisitRecord(SyncableModel):
    mother_record_id = models.CharField(max_length=36, db_index=True)
    visit_number = models.IntegerField(default=1)
    payload_json = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "anc_visit_records"


class ImmunizationRecord(SyncableModel):
    patient_id = models.CharField(max_length=36, db_index=True)
    mother_record_id = models.CharField(max_length=36, blank=True, null=True)
    vaccine_name = models.CharField(max_length=64, blank=True, default="")
    vaccine_code = models.CharField(max_length=32, blank=True, default="")
    scheduled_date = models.CharField(max_length=32, blank=True, null=True)
    administered_date = models.CharField(max_length=32, blank=True, null=True)
    is_administered = models.BooleanField(blank=True, null=True)
    is_missed = models.BooleanField(blank=True, null=True)
    missed_reason = models.TextField(blank=True, null=True)
    next_due_date = models.CharField(max_length=32, blank=True, null=True)
    batch_number = models.CharField(max_length=64, blank=True, null=True)
    anm_name = models.CharField(max_length=128, blank=True, null=True)
    site = models.CharField(max_length=64, blank=True, null=True)
    adverse_event = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "immunization_records"


class GrowthRecord(SyncableModel):
    patient_id = models.CharField(max_length=36, db_index=True)
    recorded_date = models.CharField(max_length=32, blank=True, default="")
    age_months = models.IntegerField(blank=True, null=True)
    weight_kg = models.FloatField(blank=True, null=True)
    height_cm = models.FloatField(blank=True, null=True)
    muac_cm = models.FloatField(blank=True, null=True)
    weight_for_age_z = models.FloatField(blank=True, null=True)
    height_for_age_z = models.FloatField(blank=True, null=True)
    weight_for_height_z = models.FloatField(blank=True, null=True)
    nutrition_status = models.CharField(max_length=32, blank=True, null=True)
    recorded_by = models.CharField(max_length=128, blank=True, null=True)
    awc_number = models.CharField(max_length=64, blank=True, null=True)

    class Meta:
        db_table = "growth_records"


class ChildDevelopment(SyncableModel):
    patient_id = models.CharField(max_length=36, db_index=True)
    assessment_date = models.CharField(max_length=32, blank=True, default="")
    payload_json = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "child_development"


class SurveyResponse(SyncableModel):
    patient_id = models.CharField(max_length=36, db_index=True)
    asha_worker_server_id = models.CharField(max_length=36, blank=True, null=True, db_index=True)
    survey_date = models.CharField(max_length=32, blank=True, default="")
    payload_json = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "survey_responses"


class FollowUp(SyncableModel):
    patient_id = models.CharField(max_length=36, db_index=True)
    survey_id = models.CharField(max_length=36, blank=True, null=True)
    due_date = models.CharField(max_length=32, blank=True, default="")
    completed_date = models.CharField(max_length=32, blank=True, null=True)
    is_completed = models.BooleanField(blank=True, null=True)
    is_overdue = models.BooleanField(blank=True, null=True)
    follow_type = models.CharField(max_length=64, blank=True, null=True)
    outcome = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    incentive_awarded = models.BooleanField(blank=True, null=True)

    class Meta:
        db_table = "follow_ups"


class Flag(SyncableModel):
    patient_id = models.CharField(max_length=36, db_index=True)
    asha_worker_server_id = models.CharField(max_length=36, blank=True, null=True, db_index=True)
    flag_type = models.CharField(max_length=64, blank=True, default="")
    severity = models.CharField(max_length=32, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    is_resolved = models.BooleanField(blank=True, null=True)
    resolved_at = models.CharField(max_length=32, blank=True, null=True)
    resolution_notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "flags"


class Referral(SyncableModel):
    patient_id = models.CharField(max_length=36, db_index=True)
    provider_name = models.CharField(max_length=128, blank=True, null=True)
    provider_type = models.CharField(max_length=64, blank=True, null=True)
    disease_category = models.CharField(max_length=64, blank=True, null=True)
    referral_date = models.CharField(max_length=32, blank=True, null=True)
    status = models.CharField(max_length=32, blank=True, null=True)
    outcome = models.TextField(blank=True, null=True)
    incentive_awarded = models.BooleanField(blank=True, null=True)

    class Meta:
        db_table = "referrals"


class IncentiveRecord(SyncableModel):
    action_type = models.CharField(max_length=64, blank=True, default="")
    patient_id = models.CharField(max_length=36, blank=True, null=True, db_index=True)
    reference_id = models.CharField(max_length=36, blank=True, null=True)
    points = models.IntegerField(blank=True, null=True)
    amount_inr = models.FloatField(blank=True, null=True)
    period_date = models.CharField(max_length=32, blank=True, null=True)
    is_approved = models.BooleanField(blank=True, null=True)
    approved_at = models.CharField(max_length=32, blank=True, null=True)
    payment_received = models.BooleanField(blank=True, null=True)

    class Meta:
        db_table = "incentive_records"
