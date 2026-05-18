"""Server-side flagging rules over synced Patient / SurveyResponse / Flag tables."""

import logging
from datetime import date, timedelta

from django.utils import timezone

from apps.patients.models import Flag, FollowUp, ImmunizationRecord, Patient, SurveyResponse

logger = logging.getLogger(__name__)


class FlaggingEngine:
    """Nine pilot flagging rules (NHM-aligned)."""

    def run_all_rules(self):
        results = {
            "critical_symptoms": self.flag_critical_symptoms(),
            "tb_risk": self.flag_tb_risk(),
            "high_risk_patients": self.flag_high_risk_patients(),
            "missed_followup": self.flag_missed_followup(),
            "severe_anemia": self.flag_severe_anemia(),
            "anemia": self.flag_anemia(),
            "sam": self.flag_sam(),
            "mam": self.flag_mam(),
            "immunization_defaulter": self.flag_immunization_defaulter(),
        }
        total = sum(r.get("created", 0) for r in results.values())
        logger.info("Flagging complete: %s new flags", total)
        return results

    def _create_if_missing(self, patient, flag_type, severity, description):
        exists = Flag.objects.filter(
            patient_id=patient.id,
            flag_type=flag_type,
            is_resolved=False,
            is_deleted=False,
        ).exists()
        if exists:
            return None
        now_ms = int(timezone.now().timestamp() * 1000)
        return Flag.objects.create(
            id=f"flag-{patient.id}-{flag_type}-{now_ms}",
            patient_id=patient.id,
            asha_worker_server_id=patient.asha_worker_server_id,
            flag_type=flag_type,
            severity=severity,
            description=description,
            is_resolved=False,
            is_synced=True,
            created_at=now_ms,
            updated_at=now_ms,
            is_deleted=False,
            is_mock=patient.is_mock,
        )

    def _payload(self, survey: SurveyResponse) -> dict:
        return survey.payload_json if isinstance(survey.payload_json, dict) else {}

    def _hemoglobin_from_survey(self, survey: SurveyResponse):
        pld = self._payload(survey)
        vitals = pld.get("vitals") if isinstance(pld.get("vitals"), dict) else {}
        raw = vitals.get("hemoglobin") or pld.get("hemoglobin")
        try:
            return float(raw)
        except (TypeError, ValueError):
            return None

    def flag_critical_symptoms(self):
        cutoff_ms = int((timezone.now() - timedelta(hours=48)).timestamp() * 1000)
        created = 0
        for s in SurveyResponse.objects.filter(updated_at__gte=cutoff_ms, is_deleted=False)[:500]:
            pld = self._payload(s)
            if not (pld.get("serious_severe_breathing") or pld.get("serious_chest_pain")):
                continue
            try:
                patient = Patient.objects.get(id=s.patient_id)
            except Patient.DoesNotExist:
                continue
            if self._create_if_missing(
                patient,
                "CRITICAL_SYMPTOMS",
                "critical",
                "Critical symptoms reported in recent survey",
            ):
                created += 1
        return {"created": created}

    def flag_tb_risk(self):
        created = 0
        for s in SurveyResponse.objects.filter(is_deleted=False)[:500]:
            pld = self._payload(s)
            comm = pld.get("communicable")
            cough = pld.get("comm_cough_2weeks") or (
                comm.get("coughOver2Weeks") if isinstance(comm, dict) else False
            )
            if not cough:
                continue
            try:
                p = Patient.objects.get(id=s.patient_id)
            except Patient.DoesNotExist:
                continue
            if self._create_if_missing(p, "TB_RISK", "high", "Cough > 2 weeks — TB screening recommended"):
                created += 1
        return {"created": created}

    def flag_high_risk_patients(self):
        created = 0
        for p in Patient.objects.filter(risk_level__in=["high", "critical"], is_deleted=False)[:500]:
            if self._create_if_missing(p, "HIGH_RISK", "high", f"Patient risk level: {p.risk_level}"):
                created += 1
        return {"created": created}

    def flag_missed_followup(self):
        today = date.today().isoformat()
        created = 0
        seen = set()
        for fu in FollowUp.objects.filter(is_completed=False, is_deleted=False).exclude(due_date="")[:500]:
            if fu.due_date >= today or fu.patient_id in seen:
                continue
            seen.add(fu.patient_id)
            try:
                p = Patient.objects.get(id=fu.patient_id, is_deleted=False)
            except Patient.DoesNotExist:
                continue
            if self._create_if_missing(
                p,
                "MISSED_FOLLOWUP",
                "medium",
                f"Overdue follow-up (due {fu.due_date})",
            ):
                created += 1
        return {"created": created}

    def flag_severe_anemia(self):
        created = 0
        for s in SurveyResponse.objects.filter(is_deleted=False).order_by("-updated_at")[:500]:
            hb = self._hemoglobin_from_survey(s)
            if hb is None or hb >= 7:
                continue
            try:
                p = Patient.objects.get(id=s.patient_id, is_deleted=False)
            except Patient.DoesNotExist:
                continue
            if self._create_if_missing(
                p,
                "SEVERE_ANEMIA",
                "critical",
                f"Hemoglobin {hb} g/dL — severe anemia (refer)",
            ):
                created += 1
        return {"created": created}

    def flag_anemia(self):
        created = 0
        for s in SurveyResponse.objects.filter(is_deleted=False).order_by("-updated_at")[:500]:
            hb = self._hemoglobin_from_survey(s)
            if hb is None or hb < 7 or hb >= 11:
                continue
            try:
                p = Patient.objects.get(id=s.patient_id, is_deleted=False)
            except Patient.DoesNotExist:
                continue
            if self._create_if_missing(
                p,
                "ANEMIA",
                "high",
                f"Hemoglobin {hb} g/dL — anemia (IFA supplementation)",
            ):
                created += 1
        return {"created": created}

    def flag_sam(self):
        created = 0
        for p in Patient.objects.filter(is_deleted=False).exclude(latest_weight_for_age_z__isnull=True)[:500]:
            if p.latest_weight_for_age_z is None or p.latest_weight_for_age_z >= -3:
                continue
            if self._create_if_missing(
                p,
                "SAM",
                "critical",
                "Severe acute malnutrition (WHO weight-for-age z < -3) — refer NRC",
            ):
                created += 1
        return {"created": created}

    def flag_mam(self):
        created = 0
        for p in Patient.objects.filter(is_deleted=False).exclude(latest_weight_for_age_z__isnull=True)[:500]:
            z = p.latest_weight_for_age_z
            if z is None or z < -3 or z >= -2:
                continue
            if self._create_if_missing(
                p,
                "MAM",
                "high",
                "Moderate acute malnutrition (WHO weight-for-age z -3 to -2)",
            ):
                created += 1
        return {"created": created}

    def flag_immunization_defaulter(self):
        today = date.today().isoformat()
        created = 0
        flagged_patients = set()

        for p in Patient.objects.filter(immunization_defaulter=True, is_deleted=False)[:500]:
            if self._create_if_missing(
                p,
                "IMMUNIZATION_DEFAULTER",
                "high",
                "Child marked as immunization defaulter",
            ):
                created += 1
            flagged_patients.add(p.id)

        for rec in ImmunizationRecord.objects.filter(is_deleted=False, is_administered=False)[:500]:
            if not rec.scheduled_date or rec.scheduled_date >= today:
                continue
            if rec.patient_id in flagged_patients:
                continue
            try:
                p = Patient.objects.get(id=rec.patient_id, is_deleted=False)
            except Patient.DoesNotExist:
                continue
            if self._create_if_missing(
                p,
                "IMMUNIZATION_DEFAULTER",
                "high",
                f"Overdue vaccine: {rec.vaccine_code or rec.vaccine_name}",
            ):
                created += 1
                flagged_patients.add(p.id)

        return {"created": created}
