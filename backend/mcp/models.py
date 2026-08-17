import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class CareInteraction(models.Model):
    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    patient = models.ForeignKey(
        "registry.Patient", related_name="care_interactions", on_delete=models.SET_NULL, null=True
    )
    protocol = models.CharField(max_length=120, blank=True)
    notes = models.TextField(blank=True)
    occurred_at = models.DateTimeField(default=timezone.now)
    payload = models.JSONField(default=dict, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-occurred_at"]
        indexes = [
            models.Index(fields=["patient", "protocol"], name="ix_ci_patient_protocol"),
            models.Index(fields=["occurred_at"], name="ix_ci_occurred_at"),
        ]

    def __str__(self):
        return f"CareInteraction for patient {self.patient_id} ({self.protocol or 'no protocol'})"


class ANCVisit(models.Model):
    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    patient = models.ForeignKey("registry.Patient", related_name="anc_visits", on_delete=models.SET_NULL, null=True)
    asha_worker = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    visit_number = models.IntegerField()
    visit_date = models.DateField()
    pog_weeks = models.IntegerField(null=True, blank=True)
    weight_kg = models.FloatField(null=True, blank=True)
    pulse_rate = models.IntegerField(null=True, blank=True)
    bp_systolic = models.IntegerField(null=True, blank=True)
    bp_diastolic = models.IntegerField(null=True, blank=True)
    pallor = models.CharField(max_length=10, null=True, blank=True)
    oedema = models.CharField(max_length=10, null=True, blank=True)
    jaundice = models.CharField(max_length=10, null=True, blank=True)
    any_complaints = models.TextField(blank=True)
    fundal_height_cm = models.FloatField(null=True, blank=True)
    lie_presentation = models.CharField(max_length=30, null=True, blank=True)
    fetal_movements = models.CharField(max_length=10, null=True, blank=True)
    fetal_heart_rate = models.IntegerField(null=True, blank=True)
    pv_done = models.BooleanField(default=False)
    hemoglobin_gms = models.FloatField(null=True, blank=True)
    urine_albumin = models.CharField(max_length=10, null=True, blank=True)
    urine_sugar = models.CharField(max_length=10, null=True, blank=True)
    hiv_screening = models.CharField(max_length=10, null=True, blank=True)
    syphilis_test = models.CharField(max_length=10, null=True, blank=True)
    ultrasonography = models.BooleanField(null=True, blank=True)
    gdm_screening = models.CharField(max_length=10, null=True, blank=True)
    blood_group = models.CharField(max_length=5, null=True, blank=True)
    rh_typing = models.CharField(max_length=3, null=True, blank=True)
    tsh_value = models.FloatField(null=True, blank=True)
    hbsag = models.CharField(max_length=10, null=True, blank=True)
    blood_sugar_value = models.FloatField(null=True, blank=True)
    tt_injection_given = models.BooleanField(default=False)
    ifa_tablets_given = models.IntegerField(default=0)
    calcium_tablets_given = models.BooleanField(default=False)
    albendazole_given = models.BooleanField(default=False)
    is_high_risk = models.BooleanField(default=False)
    risk_flags_summary = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["patient", "visit_number"]
        indexes = [
            models.Index(fields=["patient", "visit_number"], name="ix_anc_patient_visit"),
            models.Index(fields=["patient", "visit_date"], name="ix_anc_patient_date"),
        ]

    def __str__(self):
        return f"ANC Visit #{self.visit_number} for patient {self.patient_id} on {self.visit_date}"


class DeliveryRecord(models.Model):
    class DeliveryPlace(models.TextChoices):
        HOME = "home", "Home"
        INSTITUTION = "institution", "Institution"
        EN_ROUTE = "en_route", "En Route"
        OTHER = "other", "Other"

    class DeliveryType(models.TextChoices):
        NORMAL = "normal", "Normal"
        CS = "cs", "C-Section"
        INSTRUMENTAL = "instrumental", "Instrumental"
        OTHER = "other", "Other"

    class DeliveryOutcome(models.TextChoices):
        LIVE_BIRTH = "live_birth", "Live Birth"
        STILL_BIRTH = "still_birth", "Still Birth"
        ABORTION = "abortion", "Abortion"
        MISSED_ABORTION = "missed_abortion", "Missed Abortion"

    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    mother_patient = models.ForeignKey(
        "registry.Patient", related_name="deliveries", on_delete=models.SET_NULL, null=True
    )
    asha_worker = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    delivery_date = models.DateField()
    delivery_place = models.CharField(max_length=20, choices=DeliveryPlace.choices)
    institution_name = models.CharField(max_length=200, null=True, blank=True)
    delivery_type = models.CharField(max_length=15, choices=DeliveryType.choices)
    delivery_outcome = models.CharField(max_length=15, choices=DeliveryOutcome.choices)
    baby_sex = models.CharField(max_length=10, null=True, blank=True)
    birth_weight_kg = models.FloatField(null=True, blank=True)
    birth_weight_grams = models.IntegerField(null=True, blank=True)
    baby_cried_immediately = models.BooleanField(null=True, blank=True)
    breastfeed_within_1hr = models.BooleanField(null=True, blank=True)
    vitamin_k_given = models.BooleanField(null=True, blank=True)
    complications = models.TextField(blank=True)
    ifa_postnatal_started = models.BooleanField(default=False)
    calcium_postnatal_started = models.BooleanField(default=False)
    child_patient = models.ForeignKey(
        "registry.Patient", null=True, blank=True, related_name="birth_record", on_delete=models.SET_NULL
    )
    institution_stay_days = models.IntegerField(null=True, blank=True)
    jsy_registered = models.BooleanField(default=False)
    pmmvy_registered = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["mother_patient"], name="ix_delivery_mother"),
            models.Index(fields=["delivery_date"], name="ix_delivery_date"),
            models.Index(fields=["child_patient"], name="ix_delivery_child"),
        ]

    def __str__(self):
        return f"Delivery [{self.delivery_type}] for mother {self.mother_patient_id} on {self.delivery_date}"


class PNCVisit(models.Model):
    class VisitTiming(models.TextChoices):
        WITHIN_24HRS = "24hrs", "Within 24 hours"
        DAY_3 = "day3", "Day 3"
        DAY_7 = "day7", "Day 7"
        DAY_14 = "day14", "Day 14"
        DAY_21 = "day21", "Day 21"
        DAY_28 = "day28", "Day 28"
        DAY_42 = "day42", "Day 42"
        EXTRA = "extra", "Extra Visit"

    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    mother_patient = models.ForeignKey(
        "registry.Patient", related_name="pnc_visits", on_delete=models.SET_NULL, null=True
    )
    delivery_record = models.ForeignKey(DeliveryRecord, null=True, blank=True, on_delete=models.SET_NULL)
    asha_worker = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    visit_timing = models.CharField(max_length=10, choices=VisitTiming.choices)
    visit_date = models.DateField()
    mother_complaints = models.TextField(blank=True)
    mother_pallor = models.CharField(max_length=10, null=True, blank=True)
    mother_pulse = models.IntegerField(null=True, blank=True)
    mother_bp_sys = models.IntegerField(null=True, blank=True)
    mother_bp_dia = models.IntegerField(null=True, blank=True)
    mother_temp_f = models.FloatField(null=True, blank=True)
    breasts_condition = models.CharField(max_length=15, null=True, blank=True)
    nipples_condition = models.CharField(max_length=10, null=True, blank=True)
    uterus_tenderness = models.CharField(max_length=10, null=True, blank=True)
    bleeding_pv = models.CharField(max_length=10, null=True, blank=True)
    lochia = models.CharField(max_length=15, null=True, blank=True)
    episiotomy = models.CharField(max_length=10, null=True, blank=True)
    family_planning_counselled = models.BooleanField(default=False)
    baby_weight_kg = models.FloatField(null=True, blank=True)
    baby_urine = models.BooleanField(null=True, blank=True)
    baby_stool = models.BooleanField(null=True, blank=True)
    baby_diarrhoea = models.BooleanField(default=False)
    baby_vomiting = models.BooleanField(default=False)
    baby_convulsions = models.BooleanField(default=False)
    baby_activity = models.CharField(max_length=10, null=True, blank=True)
    baby_sucking = models.CharField(max_length=10, null=True, blank=True)
    baby_breathing = models.CharField(max_length=10, null=True, blank=True)
    baby_chest_indrawing = models.BooleanField(default=False)
    baby_temp_f = models.FloatField(null=True, blank=True)
    baby_jaundice = models.BooleanField(default=False)
    umbilical_stump = models.CharField(max_length=15, null=True, blank=True)
    is_extra_visit = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["mother_patient", "visit_timing"], name="ix_pnc_mother_timing"),
            models.Index(fields=["delivery_record"], name="ix_pnc_delivery"),
        ]

    def __str__(self):
        return f"PNC Visit ({self.visit_timing}) for mother {self.mother_patient_id} on {self.visit_date}"


class GrowthRecord(models.Model):
    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    patient = models.ForeignKey("registry.Patient", related_name="growth_records", on_delete=models.SET_NULL, null=True)
    asha_worker = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    recorded_date = models.DateField()
    recorded_by = models.CharField(max_length=10)
    age_completed_months = models.FloatField()
    weight_kg = models.FloatField()
    height_cm = models.FloatField(null=True, blank=True)
    muac_cm = models.FloatField(null=True, blank=True)
    wfa_z_score = models.FloatField(null=True, blank=True)
    wfh_z_score = models.FloatField(null=True, blank=True)
    hfa_z_score = models.FloatField(null=True, blank=True)
    nutritional_status = models.CharField(max_length=20)
    weight_change_kg = models.FloatField(null=True, blank=True)
    is_faltering = models.BooleanField(default=False)
    aww_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["patient", "recorded_date"], name="ix_growth_patient_date"),
            models.Index(fields=["nutritional_status"], name="ix_growth_nutrition"),
        ]

    def __str__(self):
        return f"GrowthRecord for patient {self.patient_id} on {self.recorded_date} ({self.nutritional_status})"


class DevelopmentMilestoneCheck(models.Model):
    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    patient = models.ForeignKey(
        "registry.Patient", related_name="milestone_checks", on_delete=models.SET_NULL, null=True
    )
    asha_worker = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    check_date = models.DateField()
    age_at_check_months = models.IntegerField()
    milestones_achieved = models.JSONField(default=dict, blank=True)
    warning_signs = models.JSONField(default=dict, blank=True)
    any_warning_sign = models.BooleanField(default=False)
    developmental_concern = models.TextField(blank=True)
    referred_to = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["patient", "age_at_check_months"], name="ix_milestone_patient_age"),
            models.Index(fields=["any_warning_sign"], name="ix_milestone_warning"),
        ]

    def __str__(self):
        return f"MilestoneCheck for patient {self.patient_id} at {self.age_at_check_months}mo on {self.check_date}"


class ImmunizationRecord(models.Model):
    VACCINE_NAME_CHOICES = [
        ("BCG", "BCG"),
        ("OPV0", "OPV-0"),
        ("HepB", "Hep-B"),
        ("OPV1", "OPV-1"),
        ("Penta1", "Penta-1"),
        ("Rota1", "Rota-1"),
        ("PCV1", "PCV-1"),
        ("IPV1", "IPV-1"),
        ("OPV2", "OPV-2"),
        ("Penta2", "Penta-2"),
        ("Rota2", "Rota-2"),
        ("OPV3", "OPV-3"),
        ("Penta3", "Penta-3"),
        ("Rota3", "Rota-3"),
        ("PCV2", "PCV-2"),
        ("IPV2", "IPV-2"),
        ("MR1", "MR-1"),
        ("JE1", "JE-1"),
        ("VitA1", "Vitamin-A-1"),
        ("PCVBooster", "PCV-Booster"),
        ("MR2", "MR-2"),
        ("JE2", "JE-2"),
        ("DPTBooster1", "DPT-Booster-1"),
        ("OPVBooster", "OPV-Booster"),
        ("VitA2", "Vitamin-A-2"),
        ("VitA3-9", "Vitamin-A-3-9"),
        ("DPTBooster2", "DPT-Booster-2"),
        ("TT10yr", "TT-10yr"),
        ("TT16yr", "TT-16yr"),
    ]

    STATUS_CHOICES = [
        ("due", "Due"),
        ("given", "Given"),
        ("missed", "Missed"),
        ("overdue", "Overdue"),
    ]

    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    patient = models.ForeignKey("registry.Patient", related_name="immunizations", on_delete=models.SET_NULL, null=True)
    asha_worker = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    vaccine_name = models.CharField(max_length=20, choices=VACCINE_NAME_CHOICES)
    dose_number = models.IntegerField(default=1)
    scheduled_date = models.DateField()
    administered_date = models.DateField(null=True, blank=True)
    administered_at = models.CharField(max_length=200, null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default="due")
    missed_reason = models.TextField(blank=True)
    next_reschedule = models.DateField(null=True, blank=True)
    fic_eligible = models.BooleanField(default=False)
    cic_eligible = models.BooleanField(default=False)
    is_vitamin_a = models.BooleanField(default=False)
    vitamin_a_dose_num = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["patient", "vaccine_name", "dose_number"], name="uq_immunization_patient_vaccine_dose"
            ),
        ]
        indexes = [
            models.Index(fields=["patient", "status"], name="ix_immunization_patient_status"),
            models.Index(fields=["scheduled_date", "status"], name="ix_immu_sched_status"),
        ]

    def __str__(self):
        return f"Immunization {self.vaccine_name} dose#{self.dose_number} for patient {self.patient_id} ({self.status})"


class IFACompliance(models.Model):
    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    patient = models.ForeignKey("registry.Patient", related_name="ifa_compliance", on_delete=models.SET_NULL, null=True)
    asha_worker = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    record_date = models.DateField()
    year_month = models.CharField(max_length=7)
    week_number = models.IntegerField()
    dose_given = models.BooleanField(default=False)
    dose_day = models.CharField(max_length=10, null=True, blank=True)
    bottle_number = models.IntegerField(null=True, blank=True)
    albendazole_given = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["patient", "year_month"], name="ix_ifa_patient_month"),
        ]

    def __str__(self):
        return f"IFA Compliance for patient {self.patient_id} {self.year_month} week#{self.week_number}"


class MCPSurveySession(models.Model):
    SESSION_TYPES = [
        ("anc_visit", "ANC Visit"),
        ("delivery_record", "Delivery Record"),
        ("pnc_visit", "PNC Visit"),
        ("child_growth", "Child Growth"),
        ("immunization_update", "Immunization Update"),
        ("milestone_check", "Milestone Check"),
        ("care_interaction", "Care Interaction"),
        ("general_survey", "General Survey"),
        ("registration", "MCP Registration"),
    ]

    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    patient = models.ForeignKey("registry.Patient", related_name="mcp_sessions", on_delete=models.SET_NULL, null=True)
    asha_worker = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    session_date = models.DateField()
    session_type = models.CharField(max_length=30, choices=SESSION_TYPES)
    linked_record_id = models.UUIDField(null=True, blank=True)
    linked_record_type = models.CharField(max_length=30, null=True, blank=True)
    risk_assessment = models.ForeignKey("risk_engine.RiskAssessment", null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-session_date", "-created_at"]
        indexes = [
            models.Index(fields=["patient", "session_date"], name="ix_mcp_session_patient_date"),
            models.Index(fields=["session_type"], name="ix_mcp_session_type"),
        ]

    def __str__(self):
        return f"MCP Session '{self.session_type}' for patient {self.patient_id} on {self.session_date}"


class WHOGrowthReference(models.Model):
    sex = models.CharField(max_length=6)
    age_months = models.FloatField()
    measurement_type = models.CharField(max_length=10)
    sd_minus_3 = models.FloatField()
    sd_minus_2 = models.FloatField()
    sd_minus_1 = models.FloatField()
    median = models.FloatField()
    sd_plus_1 = models.FloatField()
    sd_plus_2 = models.FloatField()
    sd_plus_3 = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["sex", "age_months", "measurement_type"], name="uq_who_growth_ref"),
        ]
        indexes = [
            models.Index(fields=["sex", "age_months", "measurement_type"], name="ix_who_growth_ref"),
        ]

    def __str__(self):
        return f"{self.measurement_type}/{self.sex}/{self.age_months}mo"
