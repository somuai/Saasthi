import uuid

from django.db import models


class MLModelVersion(models.Model):
    version = models.PositiveIntegerField(unique=True)
    file_path = models.CharField(max_length=500, blank=True)
    file_size_bytes = models.PositiveIntegerField(null=True, blank=True)
    cv_f1_macro = models.FloatField(null=True, blank=True)
    n_training_samples = models.PositiveIntegerField(null=True, blank=True)
    schema_version = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=False)
    trained_at = models.DateTimeField(null=True, blank=True)
    deployed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-version"]
        constraints = [
            models.UniqueConstraint(
                fields=["is_active"],
                name="uq_ml_model_active",
                condition=models.Q(is_active=True),
            )
        ]

    def __str__(self):
        return f"MLModel v{self.version} ({'active' if self.is_active else 'inactive'})"


class RiskRule(models.Model):
    class Operator(models.TextChoices):
        EQ = "eq", "Equals"
        NOT_EQ = "not_equals", "Not equals"
        GTE = "gte", "Greater than or equal"
        GT = "greater_than", "Greater than"
        LTE = "lte", "Less than or equal"
        LT = "less_than", "Less than"
        CONTAINS = "contains", "Contains"
        IN = "in", "In list"
        TRUTHY = "truthy", "Truthy"
        FALSY = "falsy", "Falsy"

    class Category(models.TextChoices):
        COMMUNICABLE = "communicable", "Communicable"
        CHRONIC = "chronic", "Chronic"
        CRITICAL = "critical", "Critical"
        MATERNAL = "maternal", "Maternal"
        CHILD = "child", "Child"
        GENERAL = "general", "General"

    code = models.CharField(max_length=80, unique=True)
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    field_path = models.CharField(max_length=180, help_text="patient.age_years or survey.answers.key")
    operator = models.CharField(max_length=32, choices=Operator.choices)
    value = models.JSONField(default=dict, blank=True)
    weight = models.PositiveIntegerField(default=1)
    severity = models.CharField(max_length=20, default="medium")
    flag_type = models.CharField(max_length=80, default="clinical_risk")
    is_active = models.BooleanField(default=True)
    version = models.PositiveIntegerField(default=1)

    is_hard_flag = models.BooleanField(default=False)
    hard_flag_message_en = models.TextField(blank=True)
    hard_flag_message_hi = models.TextField(blank=True)
    category = models.CharField(max_length=50, choices=Category.choices, default=Category.GENERAL)
    deactivated_at = models.DateTimeField(null=True, blank=True)
    deactivated_by = models.CharField(max_length=100, blank=True)
    rule_label_en = models.CharField(max_length=200, blank=True)
    rule_label_hi = models.CharField(max_length=200, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["is_active", "deactivated_at"], name="ix_risk_rules_active"),
            models.Index(fields=["is_hard_flag", "is_active"], name="ix_risk_rules_hard_flag"),
            models.Index(fields=["category", "is_active"], name="ix_risk_rules_category"),
        ]

    def __str__(self):
        return self.code


class RiskAssessment(models.Model):
    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    patient = models.ForeignKey(
        "registry.Patient", related_name="risk_assessments", on_delete=models.SET_NULL, null=True
    )
    survey_response = models.ForeignKey(
        "surveys.SurveyResponse", null=True, blank=True, on_delete=models.SET_NULL, related_name="risk_assessments"
    )
    total_score = models.PositiveIntegerField(default=0)
    level = models.CharField(max_length=20, default="low")
    explanations = models.JSONField(default=list, blank=True)
    rules_version = models.CharField(max_length=80, blank=True)

    rules_snapshot = models.JSONField(default=list, blank=True)
    triggered_by_hard_flag = models.BooleanField(default=False)
    hard_flag_rule = models.ForeignKey(
        RiskRule, null=True, blank=True, on_delete=models.SET_NULL, related_name="hard_flag_assessments"
    )
    normalized_score = models.PositiveSmallIntegerField(null=True, blank=True)
    primary_category = models.CharField(max_length=50, default=RiskRule.Category.GENERAL)
    secondary_categories = models.JSONField(default=list, blank=True)
    surveyed_at = models.DateTimeField(null=True, blank=True)
    recommended_action_en = models.TextField(blank=True)
    recommended_action_hi = models.TextField(blank=True)
    recommended_urgency = models.CharField(max_length=32, default="routine", blank=True)
    recommendation_source = models.CharField(
        max_length=30, default="rule_template", blank=True, help_text="rule_template | gemma4_api | tflite"
    )
    score_source = models.CharField(
        max_length=30, default="rule_engine", blank=True, help_text="rule_engine | tflite | ml_ensemble"
    )
    rule_engine_score = models.IntegerField(null=True, blank=True)
    ml_score = models.FloatField(null=True, blank=True)
    ml_confidence = models.FloatField(null=True, blank=True)
    ml_model_version = models.IntegerField(null=True, blank=True)

    feature_vector = models.JSONField(null=True, blank=True, help_text="MCP feature extractor output (35-dim vector)")

    patient_population = models.CharField(
        max_length=10, default="general", blank=True, help_text="general|maternal|child"
    )
    mcp_session_type = models.CharField(max_length=30, null=True, blank=True)

    protocol_checklist = models.JSONField(default=list, blank=True, help_text="Action checklist steps [{hi, en}]")
    hard_flag_category = models.CharField(
        max_length=50, blank=True, help_text="Denormalized category from hard_flag_rule"
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["patient", "created_at"], name="ix_risk_assessment_patient"),
            models.Index(fields=["level", "created_at"], name="ix_risk_assessment_level"),
            models.Index(fields=["triggered_by_hard_flag"], name="ix_risk_assessment_hard_flag"),
        ]

    def __str__(self):
        return f"RiskAssessment for patient {self.patient_id}: {self.level} (score={self.total_score})"


class HealthcareFacility(models.Model):
    class Type(models.TextChoices):
        PHC = "phc", "Primary Health Centre"
        CHC = "chc", "Community Health Centre"
        FRU = "fru", "First Referral Unit"
        DH = "dh", "District Hospital"
        SDH = "sdh", "Sub-Divisional Hospital"
        NRC = "nrc", "Nutrition Rehabilitation Centre"
        AWC = "awc", "Anganwadi Centre"
        VHSND = "vhsnd", "VHSN Day Site"
        OTHER = "other", "Other"

    name = models.CharField(max_length=200)
    name_hi = models.CharField(max_length=200, blank=True)
    facility_type = models.CharField(max_length=20, choices=Type.choices, db_index=True)
    region = models.CharField(max_length=120, blank=True, db_index=True)
    district = models.CharField(max_length=120, blank=True, db_index=True)
    block = models.CharField(max_length=120, blank=True, db_index=True)
    village = models.CharField(max_length=120, blank=True, db_index=True)
    address = models.TextField(blank=True)
    lat = models.FloatField(null=True, blank=True)
    lng = models.FloatField(null=True, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["district", "block", "name"]
        indexes = [
            models.Index(fields=["facility_type", "is_active"], name="ix_facility_type_active"),
            models.Index(fields=["district", "block"], name="ix_facility_geo"),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_facility_type_display()})"
