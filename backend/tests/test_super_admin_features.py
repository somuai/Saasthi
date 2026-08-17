import pytest
from accounts.models import User
from referrals.models import Referral
from registry.models import Patient
from risk_engine.gemma_service import EN_DISCLAIMER, HI_DISCLAIMER, GemmaService
from risk_engine.models import RiskAssessment
from shaasthi_backend.querysets import for_user_geography

from tests.factories import (
    AdminUserFactory,
    HouseholdFactory,
    PatientFactory,
    ReferralFactory,
    UserFactory,
)


@pytest.mark.django_db
class TestGeographicQueryScoping:
    """Verify that user geography query filtering respects NHM hierarchy."""

    def test_district_officer_scoping(self):
        # Create a District Officer user
        dho = UserFactory(role="district_officer", district="Sitapur", block="")

        # Create patients in different districts
        p1 = PatientFactory(district="Sitapur", block="BlockA")
        p2 = PatientFactory(district="Barabanki", block="BlockB")

        # Check that query is scoped correctly
        qs = for_user_geography(Patient.objects.all(), dho)
        assert p1 in qs
        assert p2 not in qs

    def test_block_manager_scoping(self):
        # Create a Block Manager user
        bhm = UserFactory(role="block_manager", district="Sitapur", block="BlockA")

        # Create patients in different blocks
        p1 = PatientFactory(district="Sitapur", block="BlockA")
        p2 = PatientFactory(district="Sitapur", block="BlockB")

        # Check that query is scoped correctly
        qs = for_user_geography(Patient.objects.all(), bhm)
        assert p1 in qs
        assert p2 not in qs


@pytest.mark.django_db
class TestMedGemmaDisclaimer:
    """Verify that MedGemma Service recommendations append disclaimers."""

    def test_medgemma_service_disclaimer(self):
        service = GemmaService()
        service.api_key = "mock"
        # Test mock fallback recommendation
        rec = service.generate(
            patient_context={"name": "Test", "age": 25, "village": "West"},
            assessment={"level": "medium", "explanations": [{"code": "fever", "name": "Fever"}]},
        )
        assert rec is not None
        assert EN_DISCLAIMER in rec["english"]
        assert HI_DISCLAIMER in rec["hindi"]

        # Test mock admin summary
        summary = service.generate_admin_summary({"district": "Sitapur", "total_beneficiaries": 10})
        assert summary is not None
        assert EN_DISCLAIMER in summary


@pytest.mark.django_db
class TestDoctorResponsePipeline:
    """Verify that doctors can retrieve queues and respond to referrals."""

    def test_doctor_queue_retrieval(self, api_client):
        doctor = UserFactory(role=User.Role.REFERRAL_PARTNER)
        ref1 = ReferralFactory(assigned_doctor=doctor, status=Referral.Status.DRAFT)
        ref2 = ReferralFactory(status=Referral.Status.DRAFT)  # not assigned to this doctor

        api_client.force_authenticate(user=doctor)
        resp = api_client.get("/api/v1/referrals/doctor-queue/")
        assert resp.status_code == 200
        ids = [item["id"] for item in resp.data]
        assert ref1.id in ids
        assert ref2.id not in ids

    def test_admin_doctor_queue_retrieval(self, api_client):
        admin = UserFactory(role=User.Role.ADMIN, phone="+916291688228")
        ref1 = ReferralFactory(assigned_doctor=admin, status=Referral.Status.DRAFT)
        ref2 = ReferralFactory(status=Referral.Status.DRAFT)

        api_client.force_authenticate(user=admin)
        resp = api_client.get("/api/v1/referrals/doctor-queue/")
        assert resp.status_code == 200
        ids = [item["id"] for item in resp.data]
        assert ref1.id in ids
        assert ref2.id not in ids

    def test_doctor_respond_action(self, api_client):
        doctor = UserFactory(role=User.Role.REFERRAL_PARTNER)
        ref = ReferralFactory(assigned_doctor=doctor, status=Referral.Status.DRAFT)

        api_client.force_authenticate(user=doctor)
        resp = api_client.post(
            f"/api/v1/referrals/{ref.id}/doctor-respond/",
            {
                "doctor_notes": "Patient evaluated. Prescribed IFA.",
                "prescription": "IFA 1 tab daily for 3 months",
                "recommended_action": "telemedicine",
            },
            format="json",
        )
        assert resp.status_code == 200
        ref.refresh_from_db()
        assert ref.status == Referral.Status.COMPLETED
        assert ref.doctor_notes == "Patient evaluated. Prescribed IFA."
        assert ref.metadata["prescription"] == "IFA 1 tab daily for 3 months"
        assert ref.metadata["recommended_action"] == "telemedicine"


@pytest.mark.django_db
class TestOutbreakClusteringView:
    """Verify that outbreak view identifies symptom clusters of size >= 3."""

    def test_outbreak_clustering(self, api_client):
        user = AdminUserFactory()
        hh = HouseholdFactory(village="ClusterVillage", lat=23.456, lng=87.654)
        p1 = PatientFactory(village="ClusterVillage", household=hh)
        p2 = PatientFactory(village="ClusterVillage", household=hh)
        p3 = PatientFactory(village="ClusterVillage", household=hh)

        exps = [{"code": "tb_cough", "name": "Cough for 2+ weeks"}]
        # Create risk assessments for patients in the same village and symptom
        RiskAssessment.objects.create(patient=p1, level="medium", explanations=exps)
        RiskAssessment.objects.create(patient=p2, level="medium", explanations=exps)
        RiskAssessment.objects.create(patient=p3, level="medium", explanations=exps)

        api_client.force_authenticate(user=user)
        resp = api_client.get("/dashboard/api/outbreaks/")
        assert resp.status_code == 200
        outbreaks = resp.data["outbreaks"]
        assert len(outbreaks) == 1
        assert outbreaks[0]["village"] == "ClusterVillage"
        assert outbreaks[0]["symptom"] == "tb_cough"
        assert outbreaks[0]["case_count"] == 3
        assert outbreaks[0]["lat"] == 23.456
        assert outbreaks[0]["lng"] == 87.654
