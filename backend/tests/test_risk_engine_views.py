import uuid

import pytest
from accounts.models import User
from registry.models import Patient
from rest_framework.test import APIClient
from risk_engine.models import RiskAssessment, RiskRule
from surveys.models import SurveyResponse

from tests.factories import UserFactory


@pytest.mark.django_db
class TestRiskAssessmentViewSet:
    def test_create_assessment(self, auth_client, supervisor):
        patient = Patient.objects.create(full_name="Test", gender="female", village="North")
        RiskRule.objects.create(
            code="FEVER",
            name="Has fever",
            field_path="survey.answers.fever",
            operator=RiskRule.Operator.TRUTHY,
            weight=3,
        )
        survey = SurveyResponse.objects.create(
            patient=patient,
            survey_type="screening",
            answers={"fever": True},
        )
        resp = auth_client.post(
            "/api/v1/risk/assessments/",
            {
                "patient_local_uuid": str(patient.local_uuid),
                "survey_response_local_uuid": str(survey.local_uuid),
            },
            format="json",
        )
        assert resp.status_code == 201
        assert resp.data["total_score"] == 3
        assert resp.data["flags_created"] == 1

    def test_create_assessment_no_survey(self, auth_client, supervisor):
        patient = Patient.objects.create(full_name="Test", gender="female", village="South")
        resp = auth_client.post(
            "/api/v1/risk/assessments/",
            {"patient_local_uuid": str(patient.local_uuid)},
            format="json",
        )
        assert resp.status_code == 201
        assert resp.data["total_score"] == 0
        assert resp.data["level"] == "low"

    def test_create_assessment_wrong_geography(self):
        client = APIClient()
        other_worker = UserFactory(role=User.Role.HEALTH_WORKER, village="OtherVillage")
        client.force_authenticate(other_worker)
        patient = Patient.objects.create(full_name="Other", gender="female", village="OtherVillage")
        resp = client.post(
            "/api/v1/risk/assessments/",
            {"patient_local_uuid": str(patient.local_uuid)},
            format="json",
        )
        assert resp.status_code == 403

    def test_latest_assessment(self, auth_client, supervisor):
        patient = Patient.objects.create(full_name="Test", gender="female", village="North")
        RiskAssessment.objects.create(
            patient=patient,
            total_score=5,
            level="medium",
            explanations=[],
            rules_snapshot=[],
            rules_version="1.0",
        )
        RiskAssessment.objects.create(
            patient=patient,
            total_score=10,
            level="high",
            explanations=[],
            rules_snapshot=[],
            rules_version="1.0",
        )
        resp = auth_client.get(f"/api/v1/risk/assessments/latest/{patient.local_uuid}/")
        assert resp.status_code == 200
        assert resp.data["total_score"] == 10
        assert resp.data["level"] == "high"

    def test_latest_assessment_not_found(self, auth_client, supervisor):
        resp = auth_client.get(f"/api/v1/risk/assessments/latest/{uuid.uuid4()}/")
        assert resp.status_code == 404

    def test_latest_assessment_wrong_geography(self):
        client = APIClient()
        other_worker = UserFactory(role=User.Role.HEALTH_WORKER, village="OtherVillage")
        client.force_authenticate(other_worker)
        patient = Patient.objects.create(full_name="Other", gender="female", village="OtherVillage")
        RiskAssessment.objects.create(
            patient=patient,
            total_score=5,
            level="medium",
            explanations=[],
            rules_snapshot=[],
            rules_version="1.0",
        )
        resp = client.get(f"/api/v1/risk/assessments/latest/{patient.local_uuid}/")
        assert resp.status_code == 403

    def test_retrieve_assessment(self, auth_client, supervisor):
        patient = Patient.objects.create(full_name="Test", gender="female", village="North")
        assessment = RiskAssessment.objects.create(
            patient=patient,
            total_score=5,
            level="medium",
            explanations=[],
            rules_snapshot=[],
            rules_version="1.0",
        )
        resp = auth_client.get(f"/api/v1/risk/assessments/{assessment.id}/")
        assert resp.status_code == 200
        assert resp.data["total_score"] == 5


@pytest.mark.django_db
class TestGemmaQueryEndpoint:
    def test_gemma_query_missing_patient(self, auth_client, supervisor):
        resp = auth_client.post("/api/v1/risk/assessments/gemma_query/", {"question": "test"}, format="json")
        assert resp.status_code == 400

    def test_gemma_query_patient_not_found(self, auth_client, supervisor):
        resp = auth_client.post(
            "/api/v1/risk/assessments/gemma_query/",
            {"patient_id": 99999, "question": "test"},
            format="json",
        )
        assert resp.status_code == 404

    def test_gemma_query_wrong_geography(self):
        client = APIClient()
        other_worker = UserFactory(role=User.Role.HEALTH_WORKER, village="OtherVillage")
        client.force_authenticate(other_worker)
        patient = Patient.objects.create(full_name="Other", gender="female", village="OtherVillage")
        resp = client.post(
            "/api/v1/risk/assessments/gemma_query/",
            {"patient_id": patient.id, "question": "test"},
            format="json",
        )
        assert resp.status_code == 403

    def test_gemma_query_with_assessment_context(self, auth_client, supervisor):
        patient = Patient.objects.create(full_name="Test", gender="female", village="North")
        RiskAssessment.objects.create(
            patient=patient,
            total_score=5,
            level="medium",
            explanations=[],
            rules_snapshot=[],
            rules_version="1.0",
        )
        resp = auth_client.post(
            "/api/v1/risk/assessments/gemma_query/",
            {"patient_id": patient.id, "question": "What should I do?"},
            format="json",
        )
        assert resp.status_code in (200, 503)


@pytest.mark.django_db
class TestRiskRuleViewSet:
    def test_list_rules(self, auth_client):
        RiskRule.objects.create(
            code="TEST_RULE", name="Test", field_path="test", operator=RiskRule.Operator.TRUTHY, weight=1
        )
        resp = auth_client.get("/api/v1/risk/rules/")
        assert resp.status_code == 200
        assert len(resp.data["results"]) >= 1

    def test_create_rule_needs_admin(self):
        non_admin = APIClient()
        worker = UserFactory(role=User.Role.HEALTH_WORKER)
        non_admin.force_authenticate(worker)
        payload = {
            "code": "NEW_RULE",
            "name": "New Rule",
            "field_path": "patient.age_years",
            "operator": "gte",
            "value": {"value": 60},
            "weight": 5,
        }
        resp = non_admin.post("/api/v1/risk/rules/", payload, format="json")
        assert resp.status_code == 403

    def test_create_rule_admin(self, admin_client):
        payload = {
            "code": "RULE_OK",
            "name": "Admin Rule",
            "field_path": "patient.age_years",
            "operator": "gte",
            "value": {"value": 60},
            "weight": 5,
        }
        resp = admin_client.post("/api/v1/risk/rules/", payload, format="json")
        assert resp.status_code == 201

    def test_delete_rule_soft(self, admin_client):
        rule = RiskRule.objects.create(
            code="DEL_ME", name="Delete me", field_path="test", operator=RiskRule.Operator.TRUTHY, weight=1
        )
        resp = admin_client.delete(f"/api/v1/risk/rules/{rule.id}/")
        assert resp.status_code == 204
        rule.refresh_from_db()
        assert rule.is_active is False
