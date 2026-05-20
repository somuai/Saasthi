# Generated manually for risk engine v2

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("risk_engine", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="riskrule",
            name="category",
            field=models.CharField(
                choices=[
                    ("communicable", "Communicable"),
                    ("chronic", "Chronic"),
                    ("critical", "Critical"),
                    ("maternal", "Maternal"),
                    ("general", "General"),
                ],
                default="general",
                max_length=50,
            ),
        ),
        migrations.AddField(
            model_name="riskrule",
            name="deactivated_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="riskrule",
            name="deactivated_by",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="riskrule",
            name="hard_flag_message_en",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="riskrule",
            name="hard_flag_message_hi",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="riskrule",
            name="is_hard_flag",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="riskrule",
            name="rule_label_en",
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name="riskrule",
            name="rule_label_hi",
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AlterField(
            model_name="riskrule",
            name="operator",
            field=models.CharField(
                choices=[
                    ("eq", "Equals"),
                    ("not_equals", "Not equals"),
                    ("gte", "Greater than or equal"),
                    ("greater_than", "Greater than"),
                    ("lte", "Less than or equal"),
                    ("less_than", "Less than"),
                    ("contains", "Contains"),
                    ("in", "In list"),
                    ("truthy", "Truthy"),
                    ("falsy", "Falsy"),
                ],
                max_length=32,
            ),
        ),
        migrations.AddField(
            model_name="riskassessment",
            name="hard_flag_rule",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="hard_flag_assessments",
                to="risk_engine.riskrule",
            ),
        ),
        migrations.AddField(
            model_name="riskassessment",
            name="normalized_score",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="riskassessment",
            name="primary_category",
            field=models.CharField(default="general", max_length=50),
        ),
        migrations.AddField(
            model_name="riskassessment",
            name="recommended_action_en",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="riskassessment",
            name="recommended_action_hi",
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name="riskassessment",
            name="recommended_urgency",
            field=models.CharField(blank=True, default="routine", max_length=32),
        ),
        migrations.AddField(
            model_name="riskassessment",
            name="rules_snapshot",
            field=models.JSONField(default=dict),
        ),
        migrations.AddField(
            model_name="riskassessment",
            name="secondary_categories",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="riskassessment",
            name="surveyed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="riskassessment",
            name="triggered_by_hard_flag",
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name="riskassessment",
            name="survey_response",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="risk_assessments",
                to="surveys.surveyresponse",
            ),
        ),
        migrations.AddIndex(
            model_name="riskrule",
            index=models.Index(fields=["is_active", "deactivated_at"], name="ix_risk_rules_active"),
        ),
        migrations.AddIndex(
            model_name="riskrule",
            index=models.Index(fields=["is_hard_flag", "is_active"], name="ix_risk_rules_hard_flag"),
        ),
        migrations.AddIndex(
            model_name="riskrule",
            index=models.Index(fields=["category", "is_active"], name="ix_risk_rules_category"),
        ),
        migrations.AddIndex(
            model_name="riskassessment",
            index=models.Index(fields=["patient", "created_at"], name="ix_risk_assessment_patient"),
        ),
        migrations.AddIndex(
            model_name="riskassessment",
            index=models.Index(fields=["level", "created_at"], name="ix_risk_assessment_level"),
        ),
        migrations.AddIndex(
            model_name="riskassessment",
            index=models.Index(fields=["triggered_by_hard_flag"], name="ix_risk_assessment_hard_flag"),
        ),
    ]
