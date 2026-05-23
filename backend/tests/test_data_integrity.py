import pytest
from django.apps import apps
from django.db.models.deletion import CASCADE


def _get_project_models():
    return [
        m for m in apps.get_models()
        if not m._meta.abstract
        and not m._meta.proxy
        and not m._meta.app_label.startswith("django.")
        and m._meta.app_config is not None
    ]


def _fk_fields(model):
    return [f for f in model._meta.fields if f.is_relation and f.many_to_one]


@pytest.mark.django_db
class TestForeignKeyIntegrity:
    def test_all_fks_have_explicit_on_delete(self):
        warnings = []
        for model in _get_project_models():
            for field in _fk_fields(model):
                if field.remote_field.on_delete is None:
                    warnings.append(f"{model.__name__}.{field.name} has no on_delete")
        assert not warnings, "\n".join(warnings)

    def test_no_cascade_on_patient_fk(self):
        unexpected = []
        for model in _get_project_models():
            for field in _fk_fields(model):
                if field.related_model and field.related_model.__name__ == "Patient" and field.remote_field.on_delete is CASCADE:
                    unexpected.append(f"{model.__name__}.{field.name}")
        # These are tightly-coupled child records — CASCADE is acceptable.
        acceptable = {
            "SurveyResponse",
            "FollowUp",
            "VisitRecord",
            "Flag",
            "Referral",
            "CareInteraction",
            "VisitVerificationOTP",
            "RiskAssessment",
            "ANCVisit",
            "DeliveryRecord",
            "PNCVisit",
            "GrowthRecord",
            "DevelopmentMilestoneCheck",
            "ImmunizationRecord",
            "IFACompliance",
            "MCPSurveySession",
        }
        actual_unexpected = [f for f in unexpected if f.split(".")[0] not in acceptable]
        assert not actual_unexpected, (
            f"Unexpected CASCADE on Patient FK: {actual_unexpected}\n"
            "These should use PROTECT or SET_NULL to prevent data loss on patient deletion."
        )

    def test_no_cascade_on_user_fk(self):
        unexpected = []
        for model in _get_project_models():
            for field in _fk_fields(model):
                if field.related_model and field.related_model.__name__ == "User" and field.remote_field.on_delete is CASCADE:
                    unexpected.append(f"{model.__name__}.{field.name}")
        acceptable = {
            "WorkerRegistration",
            "LogEntry",
            "AuthSession",
        }
        actual_unexpected = [f for f in unexpected if f.split(".")[0] not in acceptable]
        assert not actual_unexpected, (
            f"Unexpected CASCADE on User FK: {actual_unexpected}\n"
            "These should use PROTECT or SET_NULL to prevent data loss when a worker is deactivated."
        )

    def test_all_models_have_str(self):
        missing = []
        for model in _get_project_models():
            if model.__str__ is object.__str__:
                missing.append(model.__name__)
        assert not missing, f"Models missing __str__: {missing}"
