from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from flagging.models import Flag
from registry.models import Patient
from risk_engine.engine import RiskEngine, assess
from risk_engine.models import RiskAssessment, RiskRule
from risk_engine.rule_validator import RuleValidator
from surveys.models import SurveyResponse


@pytest.mark.django_db
def test_risk_assessment_is_explainable_and_dedupes_flags(auth_client, supervisor):
    patient = Patient.objects.create(full_name="Asha Devi", gender="female", village="North")
    RiskRule.objects.create(
        code="AGE_60",
        name="Age 60+",
        field_path="patient.age_years",
        operator=RiskRule.Operator.GTE,
        value={"value": 60},
        weight=5,
        severity="high",
        flag_type="age_risk",
    )
    patient.date_of_birth = "1950-01-01"
    patient.save()

    first = auth_client.post(
        "/api/v1/risk/assessments/",
        {"patient_local_uuid": str(patient.local_uuid)},
        format="json",
    )
    second = auth_client.post(
        "/api/v1/risk/assessments/",
        {"patient_local_uuid": str(patient.local_uuid)},
        format="json",
    )

    assert first.status_code == 201
    assert first.data["total_score"] == 5
    assert first.data["level"] == "medium"
    assert first.data["explanations"][0]["code"] == "AGE_60"
    assert first.data["flags_created"] == 1
    assert len(first.data["rules_snapshot"]) >= 1
    assert first.data["normalized_score"] is not None
    assert second.status_code == 201
    assert second.data["flags_created"] == 0
    assert RiskAssessment.objects.count() == 2
    assert Flag.objects.filter(patient=patient, flag_type="age_risk", source="risk_engine").count() == 1


@pytest.mark.django_db
def test_hard_flag_short_circuits_to_high(auth_client, supervisor):
    patient = Patient.objects.create(full_name="Emergency Case", gender="male", village="South")
    RiskRule.objects.create(
        code="HF_TEST",
        name="Unconscious",
        field_path="survey.answers.unconscious",
        operator=RiskRule.Operator.TRUTHY,
        weight=10,
        is_hard_flag=True,
        hard_flag_message_en="Call 108",
        category=RiskRule.Category.CRITICAL,
        severity="high",
        flag_type="emergency",
    )
    survey = SurveyResponse.objects.create(
        patient=patient,
        survey_type="screening",
        answers={"unconscious": True},
    )

    response = auth_client.post(
        "/api/v1/risk/assessments/",
        {
            "patient_local_uuid": str(patient.local_uuid),
            "survey_response_local_uuid": str(survey.local_uuid),
        },
        format="json",
    )

    assert response.status_code == 201
    assert response.data["level"] == "high"
    assert response.data["triggered_by_hard_flag"] is True
    assert response.data["normalized_score"] == 100
    assert response.data["total_score"] == 0
    assert len(response.data["rules_snapshot"]) >= 1


@pytest.mark.django_db
def test_normalized_score_math():
    patient = Patient.objects.create(full_name="Score Test", gender="female", village="East")
    RiskRule.objects.create(
        code="W1",
        name="Weight 1",
        field_path="survey.answers.fever",
        operator=RiskRule.Operator.TRUTHY,
        weight=2,
    )
    RiskRule.objects.create(
        code="W2",
        name="Weight 2",
        field_path="survey.answers.cough",
        operator=RiskRule.Operator.TRUTHY,
        weight=4,
    )
    survey = SurveyResponse.objects.create(
        patient=patient,
        survey_type="screening",
        answers={"fever": True, "cough": False},
    )

    result = assess(patient, survey)
    assert result["total_score"] == 2
    assert result["normalized_score"] == 33  # 2/6 * 100 rounded


@pytest.mark.django_db
def test_as_of_excludes_deactivated_rule():
    patient = Patient.objects.create(full_name="As Of", gender="female", village="West")
    rule = RiskRule.objects.create(
        code="OLD_RULE",
        name="Old",
        field_path="survey.answers.fever",
        operator=RiskRule.Operator.TRUTHY,
        weight=5,
    )
    past = timezone.now() - timedelta(days=10)
    RiskRule.objects.filter(pk=rule.pk).update(created_at=past)

    engine = RiskEngine()
    result_before = engine.evaluate(patient, None, surveyed_at=past + timedelta(days=1))
    assert result_before.total_score == 0

    survey = SurveyResponse.objects.create(
        patient=patient,
        survey_type="screening",
        answers={"fever": True},
    )
    result_match = engine.evaluate(patient, survey, surveyed_at=timezone.now())
    assert result_match.total_score == 5

    rule.deactivated_at = timezone.now() - timedelta(days=1)
    rule.save(update_fields=["deactivated_at", "updated_at"])

    result_after_deact = engine.evaluate(
        patient, survey, surveyed_at=timezone.now() - timedelta(days=2)
    )
    assert result_after_deact.total_score == 5

    result_current = engine.evaluate(patient, survey, surveyed_at=timezone.now())
    assert result_current.total_score == 0


@pytest.mark.django_db
def test_rule_create_returns_409_without_force(admin_client, admin_user):
    RiskRule.objects.create(
        code="DUP",
        name="Dup",
        field_path="survey.answers.fever",
        operator=RiskRule.Operator.TRUTHY,
        weight=1,
    )
    payload = {
        "code": "DUP2",
        "field_path": "survey.answers.fever",
        "operator": "truthy",
        "weight": 2,
    }
    response = admin_client.post("/api/v1/risk/rules/", payload, format="json")
    assert response.status_code == 409
    assert any(w["conflict_type"] == "duplicate" for w in response.data["warnings"])


@pytest.mark.django_db
def test_rule_soft_delete(admin_client, admin_user):
    rule = RiskRule.objects.create(
        code="DEL_ME",
        name="Delete",
        field_path="survey.answers.fever",
        operator=RiskRule.Operator.TRUTHY,
        weight=1,
    )
    response = admin_client.delete(f"/api/v1/risk/rules/{rule.id}/")
    assert response.status_code == 204
    rule.refresh_from_db()
    assert rule.is_active is False
    assert rule.deactivated_at is not None


@pytest.mark.django_db
def test_assessment_latest_endpoint(auth_client, supervisor):
    supervisor.village = "Central"
    supervisor.save(update_fields=["village"])
    patient = Patient.objects.create(full_name="Latest", gender="female", village="Central")
    RiskRule.objects.create(
        code="L1",
        name="Low",
        field_path="survey.answers.weakness",
        operator=RiskRule.Operator.TRUTHY,
        weight=1,
    )
    auth_client.post(
        "/api/v1/risk/assessments/",
        {"patient_local_uuid": str(patient.local_uuid)},
        format="json",
    )

    latest = auth_client.get(f"/api/v1/risk/assessments/latest/{patient.local_uuid}/")
    assert latest.status_code == 200
    assert latest.data["patient_id"] == str(patient.local_uuid)


@pytest.mark.django_db
def test_rule_validator_duplicate_warning():
    RiskRule.objects.create(
        code="EXIST",
        name="Existing",
        field_path="patient.metadata.diabetes",
        operator=RiskRule.Operator.TRUTHY,
        weight=1,
    )
    result = RuleValidator().validate(
        {
            "field_path": "patient.metadata.diabetes",
            "operator": RiskRule.Operator.TRUTHY,
            "value": {},
        }
    )
    assert any(w.conflict_type == "duplicate" for w in result.warnings)


@pytest.mark.django_db
def test_e2e_golden_path_scoring():
    """Section 9.1 — fever + cough>=2w + diabetes metadata."""
    patient = Patient.objects.create(
        full_name="Golden",
        gender="female",
        village="East",
        metadata={"diabetes": True},
        date_of_birth="1981-01-01",
    )
    RiskRule.objects.create(
        code="FEVER",
        name="Fever",
        field_path="survey.answers.fever",
        operator=RiskRule.Operator.TRUTHY,
        weight=3,
        category=RiskRule.Category.COMMUNICABLE,
    )
    RiskRule.objects.create(
        code="COUGH_2W",
        name="Cough 2w",
        field_path="survey.answers.cough_duration_weeks",
        operator=RiskRule.Operator.GTE,
        value={"value": 2},
        weight=4,
        category=RiskRule.Category.COMMUNICABLE,
    )
    RiskRule.objects.create(
        code="DIAB",
        name="Diabetes",
        field_path="patient.metadata.diabetes",
        operator=RiskRule.Operator.TRUTHY,
        weight=3,
        category=RiskRule.Category.CHRONIC,
    )
    survey = SurveyResponse.objects.create(
        patient=patient,
        survey_type="screening",
        answers={"fever": True, "cough_duration_weeks": 3},
    )
    result = assess(patient, survey)
    assert result["total_score"] == 10
    assert result["level"] == "high"
    assert result["primary_category"] == "communicable"
    assert "chronic" in result["secondary_categories"]
    assert result["explanations"][0]["actual_value"] is not None


@pytest.mark.django_db
def test_supervisor_cannot_create_rules(auth_client, supervisor):
    payload = {
        "code": "NOPE",
        "field_path": "survey.answers.fever",
        "operator": "truthy",
        "weight": 1,
    }
    response = auth_client.post("/api/v1/risk/rules/", payload, format="json")
    assert response.status_code == 403


@pytest.mark.django_db
def test_resolve_patient_metadata():
    patient = Patient.objects.create(
        full_name="Meta",
        gender="female",
        village="V",
        metadata={"diabetes": True},
    )
    RiskRule.objects.create(
        code="DIAB",
        name="Diabetes",
        field_path="patient.metadata.diabetes",
        operator=RiskRule.Operator.TRUTHY,
        weight=3,
    )
    result = assess(patient, None)
    assert result["total_score"] == 3
