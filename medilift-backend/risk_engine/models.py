import uuid

from django.db import models


class RiskRule(models.Model):
    class Operator(models.TextChoices):
        EQ = "eq", "Equals"
        GTE = "gte", "Greater than or equal"
        LTE = "lte", "Less than or equal"
        CONTAINS = "contains", "Contains"
        TRUTHY = "truthy", "Truthy"

    code = models.CharField(max_length=80, unique=True)
    name = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    field_path = models.CharField(max_length=180, help_text="patient.age_years or survey.answers.key")
    operator = models.CharField(max_length=20, choices=Operator.choices)
    value = models.JSONField(default=dict, blank=True)
    weight = models.PositiveIntegerField(default=1)
    severity = models.CharField(max_length=20, default="medium")
    flag_type = models.CharField(max_length=80, default="clinical_risk")
    is_active = models.BooleanField(default=True)
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.code


class RiskAssessment(models.Model):
    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    patient = models.ForeignKey("registry.Patient", related_name="risk_assessments", on_delete=models.CASCADE)
    survey_response = models.ForeignKey("surveys.SurveyResponse", null=True, blank=True, on_delete=models.SET_NULL)
    total_score = models.PositiveIntegerField(default=0)
    level = models.CharField(max_length=20, default="low")
    explanations = models.JSONField(default=list, blank=True)
    rules_version = models.CharField(max_length=80, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
