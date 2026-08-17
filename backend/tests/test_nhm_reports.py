import pytest
from django.utils import timezone
from mcp.models import PNCVisit

from tests.factories import (
    AdminUserFactory,
    ANCVisitFactory,
    PatientFactory,
    SupervisorFactory,
    UserFactory,
    WorkerRegistrationFactory,
)


@pytest.mark.django_db
class TestNHMReportExports:
    def test_rch_shadow_register_includes_pregnancy_rows(self, api_client):
        admin = AdminUserFactory()
        asha = UserFactory(first_name="Mina", last_name="Das")
        patient = PatientFactory(
            full_name="Rina Das",
            asha_worker=asha,
            pregnancy_status=True,
            is_high_risk_pregnancy=True,
            mcts_rch_id="RCH-WB-001",
            lmp_date=timezone.localdate(),
            edd=timezone.localdate(),
        )
        ANCVisitFactory(patient=patient, visit_number=1, hemoglobin_gms=9.8, is_high_risk=True)

        api_client.force_authenticate(admin)
        resp = api_client.get("/api/anm/reports/rch-shadow-register/")

        assert resp.status_code == 200
        body = resp.content.decode("utf-8-sig")
        assert "RCH/MCTS ID" in body
        assert "RCH-WB-001" in body
        assert "Rina Das" in body
        assert "High Risk Pregnancy" in body

    def test_supervisor_rch_export_is_scoped_to_registered_ashas(self, api_client):
        supervisor = SupervisorFactory()
        owned_asha = UserFactory(first_name="Owned", phone="+919999999001")
        other_asha = UserFactory(first_name="Other", phone="+919999999002")
        WorkerRegistrationFactory(supervisor=supervisor, phone=owned_asha.phone)
        PatientFactory(full_name="Owned Mother", asha_worker=owned_asha, pregnancy_status=True)
        PatientFactory(full_name="Other Mother", asha_worker=other_asha, pregnancy_status=True)

        api_client.force_authenticate(supervisor)
        resp = api_client.get("/api/anm/reports/rch-shadow-register/")

        assert resp.status_code == 200
        body = resp.content.decode("utf-8-sig")
        assert "Owned Mother" in body
        assert "Other Mother" not in body

    def test_format_d_csv_exports_monthly_metrics(self, api_client):
        admin = AdminUserFactory()
        patient = PatientFactory(
            village="Kalyani",
            pregnancy_status=True,
            is_high_risk_pregnancy=True,
            created_at=timezone.now(),
        )
        ANCVisitFactory(patient=patient, visit_number=1, visit_date=timezone.localdate())
        ANCVisitFactory(patient=patient, visit_number=4, visit_date=timezone.localdate())

        api_client.force_authenticate(admin)
        resp = api_client.get(f"/api/anm/reports/format-d/?month={timezone.now().strftime('%Y-%m')}")

        assert resp.status_code == 200
        body = resp.content.decode("utf-8-sig")
        assert "Village,ASHA Workers,Registered Pregnancies" in body
        assert "Kalyani" in body

    def test_hrp_slip_and_hbnc_grid_download(self, api_client):
        admin = AdminUserFactory()
        patient = PatientFactory(
            full_name="Maya Sarkar",
            pregnancy_status=True,
            is_high_risk_pregnancy=True,
            mcts_rch_id="RCH-WB-002",
        )
        ANCVisitFactory(patient=patient, visit_number=2, hemoglobin_gms=8.5, bp_systolic=150)
        PNCVisit.objects.create(
            mother_patient=patient,
            visit_timing=PNCVisit.VisitTiming.DAY_42,
            visit_date=timezone.localdate(),
            baby_weight_kg=3.2,
            baby_sucking="good",
            baby_breathing="normal",
        )

        api_client.force_authenticate(admin)
        slip = api_client.get(f"/api/anm/reports/hrp-referral-slip/{patient.pk}/")
        grid = api_client.get(f"/api/anm/reports/hbnc-grid/{patient.pk}/")

        assert slip.status_code == 200
        assert slip["Content-Type"] == "application/pdf"
        assert grid.status_code == 200
        body = grid.content.decode("utf-8-sig")
        assert "Day 42" in body
        assert "3.2" in body

    def test_mother_record_sync_side_effects(self, api_client):
        asha = UserFactory(phone="+919999999003")
        patient = PatientFactory(asha_worker=asha, pregnancy_status=True)

        import json

        pnc_day14_payload = {
            "visitDate": "2026-06-02",
            "motherTemp": 37.0,
            "excessiveBleeding": True,
            "babyWeightKg": 3.1,
            "babyTemp": 36.5,
            "notes": "Healthy baby, bleeding mother",
            "sepsisLethargy": False,
            "sepsisConvulsions": False,
            "sepsisChestIndrawing": False,
            "sepsisTempInstability": False,
            "sepsisUmbilicalPus": False,
            "sepsisPoorFeeding": False,
            "sepsisFastBreathing": False,
        }

        import uuid

        mother_rec_uuid = uuid.uuid4()
        push_data = {
            "device_id": "test-device-1",
            "changes": {
                "mother_records": {
                    "created": [
                        {
                            "id": str(mother_rec_uuid),
                            "patient_id": str(patient.local_uuid),
                            "lmp_date": "2026-01-01",
                            "edd": "2026-10-08",
                            "gravida": 2,
                            "is_high_risk": True,
                            "is_pmmvy_eligible": True,
                            "bank_account": "1234567890",
                            "bank_ifsc": "SBIN0000001",
                            "bank_name": "State Bank of India",
                            "blood_group": "B",
                            "rh_type": "Pos",
                            "mcts_rch_id_mother": "RCH-M-9999",
                            "prev_live_births": 1,
                            "delivery_date": "2026-05-15",
                            "delivery_place": "Kalyani SDH",
                            "birth_weight_kg": 3.1,
                            "birth_registration_no": "BRN-101",
                            "sub_centre_reg_no": "SC-REG-777",
                            "fixed_vhsnd_day": "Tuesday",
                            "pnc_day14_json": json.dumps(pnc_day14_payload),
                            "created_at": 1774890000000,
                            "updated_at": 1774890000000,
                            "is_deleted": False,
                            "is_mock": False,
                        }
                    ],
                    "updated": [],
                    "deleted": [],
                }
            },
            "last_pulled_at": 1774890000000,
        }

        api_client.force_authenticate(asha)
        resp = api_client.post("/api/v1/sync/push/", push_data, format="json")
        print("SYNC ERROR RESP DATA:", resp.data)
        assert resp.status_code == 200

        patient.refresh_from_db()
        assert str(patient.lmp_date) == "2026-01-01"
        assert str(patient.edd) == "2026-10-08"
        assert patient.gravida == 2
        assert patient.is_high_risk_pregnancy is True
        assert patient.pmmvy_eligible is True
        assert patient.bank_account_number == "1234567890"
        assert patient.bank_ifsc == "SBIN0000001"
        assert patient.bank_branch_name == "State Bank of India"
        assert patient.blood_group == "B"
        assert patient.rh_typing == "Pos"
        assert patient.mcts_rch_id == "RCH-M-9999"
        assert patient.para == 1
        assert str(patient.last_delivery_date) == "2026-05-15"
        assert patient.last_delivery_place == "Kalyani SDH"
        assert patient.birth_weight_kg == 3.1
        assert patient.birth_registration_number == "BRN-101"
        assert patient.metadata.get("sub_centre_reg_no") == "SC-REG-777"
        assert patient.metadata.get("fixed_vhsnd_day") == "Tuesday"

        pnc_visit = PNCVisit.objects.filter(mother_patient=patient, visit_timing="day14").first()
        assert pnc_visit is not None
        assert str(pnc_visit.visit_date) == "2026-06-02"
        assert abs(pnc_visit.mother_temp_f - 98.6) < 0.01
        assert pnc_visit.bleeding_pv == "excessive"
        assert pnc_visit.baby_weight_kg == 3.1
        assert abs(pnc_visit.baby_temp_f - 97.7) < 0.01
        assert pnc_visit.mother_complaints == "Healthy baby, bleeding mother"
        assert pnc_visit.baby_convulsions is False
        assert pnc_visit.baby_activity == "normal"
