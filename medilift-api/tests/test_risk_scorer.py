from django.test import TestCase

from apps.risk_engine.scorer import score_patient_dict


class RiskScorerTests(TestCase):
    def test_pregnant_medium_risk(self):
        r = score_patient_dict({"is_pregnant": True})
        self.assertGreaterEqual(r["score"], 20)
        self.assertIn(r["risk_level"], ("low", "medium", "high", "critical"))

    def test_critical_symptoms(self):
        r = score_patient_dict({}, {"serious_severe_breathing": True})
        self.assertGreaterEqual(r["score"], 35)
