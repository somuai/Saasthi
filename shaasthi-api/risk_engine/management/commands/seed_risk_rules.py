"""Seed NHM-aligned default risk rules. Run once after migration: python manage.py seed_risk_rules"""

from django.core.management.base import BaseCommand

from risk_engine.models import RiskRule

DEFAULT_RULES = [
    {
        "code": "HF_UNCONSCIOUS",
        "name": "Unconscious / unresponsive",
        "field_path": "survey.answers.unconscious",
        "operator": RiskRule.Operator.TRUTHY,
        "weight": 10,
        "is_hard_flag": True,
        "category": RiskRule.Category.CRITICAL,
        "rule_label_en": "Unconscious / unresponsive",
        "rule_label_hi": "बेहोशी / अनुत्तरदायी",
        "hard_flag_message_en": "EMERGENCY — Patient unresponsive. Call 108 immediately.",
        "hard_flag_message_hi": "आपातकाल — रोगी बेहोश है। तुरंत 108 कॉल करें।",
        "severity": "high",
        "flag_type": "emergency",
    },
    {
        "code": "HF_CONVULSIONS",
        "name": "Convulsions / seizures",
        "field_path": "survey.answers.convulsions",
        "operator": RiskRule.Operator.TRUTHY,
        "weight": 10,
        "is_hard_flag": True,
        "category": RiskRule.Category.CRITICAL,
        "rule_label_en": "Convulsions / seizures",
        "rule_label_hi": "दौरे",
        "hard_flag_message_en": "EMERGENCY — Convulsions observed. Refer to hospital immediately.",
        "hard_flag_message_hi": "आपातकाल — दौरे पड़ रहे हैं। तुरंत अस्पताल भेजें।",
        "severity": "high",
        "flag_type": "emergency",
    },
    {
        "code": "HF_SEVERE_BREATH",
        "name": "Severe breathlessness",
        "field_path": "survey.answers.breathlessness_severity",
        "operator": RiskRule.Operator.EQ,
        "value": {"value": "severe"},
        "weight": 10,
        "is_hard_flag": True,
        "category": RiskRule.Category.CRITICAL,
        "rule_label_en": "Severe breathlessness",
        "rule_label_hi": "गंभीर सांस की तकलीफ",
        "hard_flag_message_en": "EMERGENCY — Severe respiratory distress. Refer immediately.",
        "hard_flag_message_hi": "आपातकाल — गंभीर सांस की तकलीफ। तुरंत रेफर करें।",
        "severity": "high",
        "flag_type": "emergency",
    },
    {
        "code": "FEVER_ACTIVE",
        "name": "Active fever",
        "field_path": "survey.answers.fever",
        "operator": RiskRule.Operator.TRUTHY,
        "weight": 3,
        "category": RiskRule.Category.COMMUNICABLE,
        "rule_label_en": "Active fever",
        "rule_label_hi": "सक्रिय बुखार",
    },
    {
        "code": "COUGH_TB_2W",
        "name": "Cough >= 2 weeks (TB indicator)",
        "field_path": "survey.answers.cough_duration_weeks",
        "operator": RiskRule.Operator.GTE,
        "value": {"value": 2},
        "weight": 4,
        "category": RiskRule.Category.COMMUNICABLE,
        "rule_label_en": "Cough >= 2 weeks (TB indicator)",
        "rule_label_hi": "2 सप्ताह से अधिक खांसी (TB संकेतक)",
    },
    {
        "code": "DIABETES_KNOWN",
        "name": "Known diabetes",
        "field_path": "patient.metadata.diabetes",
        "operator": RiskRule.Operator.TRUTHY,
        "weight": 3,
        "category": RiskRule.Category.CHRONIC,
        "rule_label_en": "Known diabetes",
        "rule_label_hi": "मधुमेह",
    },
    {
        "code": "HYPERTENSION_KNOWN",
        "name": "Known hypertension",
        "field_path": "patient.metadata.hypertension",
        "operator": RiskRule.Operator.TRUTHY,
        "weight": 3,
        "category": RiskRule.Category.CHRONIC,
        "rule_label_en": "Known hypertension",
        "rule_label_hi": "उच्च रक्तचाप",
    },
    {
        "code": "BP_SYS_HIGH",
        "name": "High systolic BP (>140)",
        "field_path": "survey.answers.blood_pressure_sys",
        "operator": RiskRule.Operator.GT,
        "value": {"value": 140},
        "weight": 3,
        "category": RiskRule.Category.CHRONIC,
        "rule_label_en": "High systolic BP (>140)",
        "rule_label_hi": "उच्च सिस्टोलिक BP (>140)",
    },
    {
        "code": "AGE_OVER_60",
        "name": "Age > 60 years",
        "field_path": "patient.age_years",
        "operator": RiskRule.Operator.GT,
        "value": {"value": 60},
        "weight": 2,
        "category": RiskRule.Category.GENERAL,
        "rule_label_en": "Age > 60 years",
        "rule_label_hi": "आयु > 60 वर्ष",
    },
    {
        "code": "AGE_UNDER_5",
        "name": "Child under 5 (IMNCI)",
        "field_path": "patient.age_years",
        "operator": RiskRule.Operator.LT,
        "value": {"value": 5},
        "weight": 2,
        "category": RiskRule.Category.GENERAL,
        "rule_label_en": "Child under 5 (IMNCI)",
        "rule_label_hi": "5 वर्ष से कम बच्चा (IMNCI)",
    },
    {
        "code": "PREGNANT",
        "name": "Currently pregnant",
        "field_path": "patient.metadata.pregnancy_status",
        "operator": RiskRule.Operator.TRUTHY,
        "weight": 2,
        "category": RiskRule.Category.MATERNAL,
        "rule_label_en": "Currently pregnant",
        "rule_label_hi": "गर्भवती",
    },
    {
        "code": "HF_FETAL_MOVEMENT",
        "name": "Reduced fetal movement",
        "field_path": "survey.answers.reduced_fetal_movement",
        "operator": RiskRule.Operator.TRUTHY,
        "weight": 4,
        "is_hard_flag": True,
        "category": RiskRule.Category.MATERNAL,
        "rule_label_en": "Reduced fetal movement",
        "rule_label_hi": "भ्रूण की कम हलचल",
        "hard_flag_message_en": "Reduced fetal movement — refer to CHC immediately.",
        "hard_flag_message_hi": "भ्रूण की कम हलचल — तुरंत CHC रेफर करें।",
        "severity": "high",
        "flag_type": "maternal_emergency",
    },
    {
        "code": "WEAKNESS_GENERAL",
        "name": "General weakness",
        "field_path": "survey.answers.weakness",
        "operator": RiskRule.Operator.TRUTHY,
        "weight": 1,
        "category": RiskRule.Category.GENERAL,
        "rule_label_en": "General weakness",
        "rule_label_hi": "सामान्य कमज़ोरी",
    },
]


class Command(BaseCommand):
    help = "Seed default NHM-aligned risk rules"

    def handle(self, *args, **options):
        created = 0
        updated = 0
        for rule_data in DEFAULT_RULES:
            code = rule_data["code"]
            defaults = {k: v for k, v in rule_data.items() if k != "code"}
            _, was_created = RiskRule.objects.update_or_create(code=code, defaults=defaults)
            if was_created:
                created += 1
            else:
                updated += 1
        self.stdout.write(self.style.SUCCESS(f"Risk rules seeded: {created} created, {updated} updated"))
