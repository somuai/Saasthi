import pytest

from flagging.models import Flag
from registry.models import Patient
from risk_engine.models import RiskAssessment, RiskRule


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
    assert second.status_code == 201
    assert second.data["flags_created"] == 0
    assert RiskAssessment.objects.count() == 2
    assert Flag.objects.filter(patient=patient, flag_type="age_risk", source="risk_engine").count() == 1
