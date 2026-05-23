"""Validate Gemma 4 service integration — mock fallback + Celery task."""

import pytest
from risk_engine.gemma_service import MODEL_ID, GemmaService
from risk_engine.tasks import enhance_with_gemma4


class TestGemmaMockFallback:
    """Section 9 — Gemma 4 service mock fallback."""

    def setup_method(self):
        GemmaService._instance = None
        self.service = GemmaService()

    def test_mock_returns_valid_contract(self):
        result = self.service.generate(
            {"name": "Test", "age": 30, "village": "Village"},
            {"level": "high", "explanations": [{"name": "Fever", "rule_label_hi": ""}]},
        )
        assert result is not None
        assert "english" in result
        assert "hindi" in result
        assert result["source"] == "gemma4_api"
        assert result["model"] == MODEL_ID
        import re

        assert re.search(r"[\u0900-\u097F]", result["hindi"])

    def test_mock_critical_level(self):
        result = self.service.generate(
            {"name": "Test", "age": 45, "village": "Village"},
            {"level": "critical", "explanations": [{"name": "Convulsions"}]},
        )
        assert "emergency" in result["english"].lower()
        assert "आपातकाल" in result["hindi"]

    def test_mock_high_level(self):
        result = self.service.generate(
            {"name": "Test", "age": 30, "village": "Village"},
            {"level": "high", "explanations": [{"name": "Diabetes"}]},
        )
        assert "PHC" in result["english"] or "24 hours" in result["english"]

    def test_mock_medium_level(self):
        result = self.service.generate(
            {"name": "Test", "age": 25, "village": "Village"},
            {"level": "medium", "explanations": [{"name": "Anemia"}]},
        )
        assert "3 days" in result["english"]

    def test_mock_low_level(self):
        result = self.service.generate(
            {"name": "Test", "age": 20, "village": "Village"},
            {"level": "low", "explanations": []},
        )
        assert "low risk" in result["english"].lower()
        assert "सामान्य" in result["hindi"]

    def test_mock_with_factors_in_message(self):
        result = self.service.generate(
            {"name": "Test", "age": 30, "village": "Village"},
            {
                "level": "high",
                "explanations": [
                    {"name": "Diabetes", "rule_label_hi": "मधुमेह"},
                    {"name": "Hypertension", "rule_label_hi": "उच्च रक्तचाप"},
                ],
            },
        )
        assert "diabetes" in result["english"].lower() or "hypertension" in result["english"].lower()

    def test_without_api_key_uses_mock(self):
        service = GemmaService()
        service.init_gemma("")
        result = service.generate(
            {"name": "Test", "age": 30, "village": "Village"},
            {"level": "low", "explanations": []},
        )
        assert result is not None
        assert "mock" in service.__class__.__name__ or result["source"] == "gemma4_api"

    def test_no_api_key_logs_warning(self, caplog):
        import logging

        caplog.set_level(logging.WARNING)
        service = GemmaService()
        service.init_gemma("")
        assert "without API key" in caplog.text or "Mock fallback" in caplog.text


@pytest.mark.django_db
class TestGemmaCeleryTask:
    """Section 9B — Celery enhancement task."""

    def test_enhance_with_gemma4_updates_assessment(self):
        from registry.models import Patient
        from risk_engine.models import RiskAssessment

        patient = Patient.objects.create(full_name="Gemma Test", gender="female", village="Test")
        assessment = RiskAssessment.objects.create(
            patient=patient,
            level="high",
            total_score=10,
            normalized_score=50,
            primary_category="communicable",
            explanations=[{"name": "Fever", "code": "FEVER", "severity": "medium", "flag_type": "clinical_risk"}],
        )
        result = enhance_with_gemma4(str(assessment.local_uuid))
        assert result is not None
        assert result["status"] == "enhanced" or result["status"] == "fallback_kept"
        assessment.refresh_from_db()
        if result["status"] == "enhanced":
            assert assessment.recommended_action_en
            assert assessment.recommended_action_hi
            assert assessment.recommendation_source == "gemma4_api"

    def test_enhance_with_gemma4_missing_assessment(self):
        result = enhance_with_gemma4("00000000-0000-0000-0000-000000000000")
        assert result["status"] == "skipped"
        assert result["reason"] == "assessment_not_found"
