import logging
from datetime import date

from accounts.views import audit
from django.utils import timezone
from registry.models import Patient
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from shaasthi_backend.querysets import for_user_geography

from .models import (
    ANCVisit,
    CareInteraction,
    DeliveryRecord,
    DevelopmentMilestoneCheck,
    GrowthRecord,
    IFACompliance,
    ImmunizationRecord,
    MCPSurveySession,
    PNCVisit,
)
from .serializers import (
    ANCVisitSerializer,
    CareInteractionSerializer,
    DeliveryRecordSerializer,
    DevelopmentMilestoneCheckSerializer,
    GrowthRecordSerializer,
    IFAComplianceSerializer,
    ImmunizationRecordSerializer,
    MCPSurveySessionSerializer,
    PNCVisitSerializer,
)

logger = logging.getLogger(__name__)

SURVEY_SESSION_MAP = {
    ANCVisit: ("anc_visit", "ANCVisit"),
    DeliveryRecord: ("delivery_record", "DeliveryRecord"),
    PNCVisit: ("pnc_visit", "PNCVisit"),
    GrowthRecord: ("child_growth", "GrowthRecord"),
    ImmunizationRecord: ("immunization_update", "ImmunizationRecord"),
    DevelopmentMilestoneCheck: ("milestone_check", "MilestoneCheck"),
}


def _create_mcp_session(instance, request_user, session_type, linked_type):
    MCPSurveySession.objects.create(
        patient=instance.patient if hasattr(instance, "mother_patient") is False else instance.mother_patient,
        asha_worker=request_user,
        session_date=date.today(),
        session_type=session_type,
        linked_record_id=instance.local_uuid,
        linked_record_type=linked_type,
    )


def _trigger_mcp_risk_assessment(instance, patient, request_user, population, session_type):
    try:
        from risk_engine.tasks import run_mcp_risk_assessment

        patient_local_uuid = str(patient.local_uuid)
        instance_local_uuid = str(getattr(instance, "local_uuid", ""))
        run_mcp_risk_assessment.delay(
            patient_local_uuid=patient_local_uuid,
            instance_local_uuid=instance_local_uuid,
            instance_model=instance._meta.model_name if hasattr(instance, "_meta") else "",
            population=population,
            session_type=session_type,
        )
    except Exception:
        logger.exception("MCP risk assessment task enqueue failed for patient %s", patient_local_uuid)


def _create_incentive(immunization_record, request_user):
    if not (immunization_record.fic_eligible or immunization_record.cic_eligible):
        return
    try:
        from incentives.models import IncentiveLedgerEntry

        amount = 200 if immunization_record.fic_eligible else 100
        entry = IncentiveLedgerEntry.objects.create(
            worker=request_user,
            activity_type=IncentiveLedgerEntry.ActivityType.SURVEY_COMPLETION,
            amount_paise=amount * 100,
            status=IncentiveLedgerEntry.Status.PENDING,
            reference_id=immunization_record.local_uuid,
            reference_type="ImmunizationRecord",
            month_year=timezone.now().strftime("%Y-%m"),
            description_en=f"Incentive for {'FIC' if immunization_record.fic_eligible else 'CIC'} eligible immunization",
            description_hi=f"{'FIC' if immunization_record.fic_eligible else 'CIC'} टीकाकरण के लिए प्रोत्साहन",
        )
        audit(None, "incentives.create", "IncentiveLedgerEntry", entry.local_uuid)
    except Exception:
        logger.exception("Incentive creation failed for immunization %s", immunization_record.local_uuid)


class CareInteractionViewSet(viewsets.ModelViewSet):
    serializer_class = CareInteractionSerializer
    filterset_fields = ["protocol", "patient"]
    throttle_scope = "mcp_write"

    def get_queryset(self):
        patient_ids = for_user_geography(Patient.objects.all(), self.request.user).values("id")
        return CareInteraction.objects.select_related("patient").filter(patient_id__in=patient_ids)

    def perform_create(self, serializer):
        obj = serializer.save(created_by=self.request.user)
        audit(self.request, "mcp.care_interaction.create", "CareInteraction", obj.local_uuid)


class ANCVisitViewSet(viewsets.ModelViewSet):
    serializer_class = ANCVisitSerializer
    filterset_fields = ["patient", "visit_number", "is_high_risk"]
    throttle_scope = "mcp_write"

    def get_queryset(self):
        patient_ids = for_user_geography(Patient.objects.all(), self.request.user).values("id")
        return ANCVisit.objects.select_related("patient").filter(patient_id__in=patient_ids)

    def perform_create(self, serializer):
        obj = serializer.save(asha_worker=self.request.user)
        audit(self.request, "mcp.anc_visit.create", "ANCVisit", obj.local_uuid)
        _create_mcp_session(obj, self.request.user, "anc_visit", "ANCVisit")
        _trigger_mcp_risk_assessment(obj, obj.patient, self.request.user, "maternal", "anc_visit")


class DeliveryRecordViewSet(viewsets.ModelViewSet):
    serializer_class = DeliveryRecordSerializer
    filterset_fields = ["mother_patient", "delivery_type", "delivery_place"]
    throttle_scope = "mcp_write"

    def get_queryset(self):
        patient_ids = for_user_geography(Patient.objects.all(), self.request.user).values("id")
        return DeliveryRecord.objects.select_related("mother_patient").filter(mother_patient_id__in=patient_ids)

    def perform_create(self, serializer):
        obj = serializer.save(asha_worker=self.request.user)
        audit(self.request, "mcp.delivery.create", "DeliveryRecord", obj.local_uuid)
        _create_mcp_session(obj, self.request.user, "delivery_record", "DeliveryRecord")
        _trigger_mcp_risk_assessment(obj, obj.mother_patient, self.request.user, "maternal", "delivery_record")


class PNCVisitViewSet(viewsets.ModelViewSet):
    serializer_class = PNCVisitSerializer
    filterset_fields = ["mother_patient", "visit_timing", "is_extra_visit"]
    throttle_scope = "mcp_write"

    def get_queryset(self):
        patient_ids = for_user_geography(Patient.objects.all(), self.request.user).values("id")
        return PNCVisit.objects.select_related("mother_patient").filter(mother_patient_id__in=patient_ids)

    def perform_create(self, serializer):
        obj = serializer.save(asha_worker=self.request.user)
        audit(self.request, "mcp.pnc_visit.create", "PNCVisit", obj.local_uuid)
        _create_mcp_session(obj, self.request.user, "pnc_visit", "PNCVisit")
        _trigger_mcp_risk_assessment(obj, obj.mother_patient, self.request.user, "maternal", "pnc_visit")


class GrowthRecordViewSet(viewsets.ModelViewSet):
    serializer_class = GrowthRecordSerializer
    filterset_fields = ["patient", "nutritional_status", "is_faltering"]
    throttle_scope = "mcp_write"

    def get_queryset(self):
        patient_ids = for_user_geography(Patient.objects.all(), self.request.user).values("id")
        return GrowthRecord.objects.select_related("patient").filter(patient_id__in=patient_ids)

    def perform_create(self, serializer):
        obj = serializer.save(asha_worker=self.request.user)
        audit(self.request, "mcp.growth_record.create", "GrowthRecord", obj.local_uuid)
        _create_mcp_session(obj, self.request.user, "child_growth", "GrowthRecord")
        _trigger_mcp_risk_assessment(obj, obj.patient, self.request.user, "child", "child_growth")


class DevelopmentMilestoneCheckViewSet(viewsets.ModelViewSet):
    serializer_class = DevelopmentMilestoneCheckSerializer
    filterset_fields = ["patient", "any_warning_sign"]
    throttle_scope = "mcp_write"

    def get_queryset(self):
        patient_ids = for_user_geography(Patient.objects.all(), self.request.user).values("id")
        return DevelopmentMilestoneCheck.objects.select_related("patient").filter(patient_id__in=patient_ids)

    def perform_create(self, serializer):
        obj = serializer.save(asha_worker=self.request.user)
        audit(self.request, "mcp.milestone_check.create", "DevelopmentMilestoneCheck", obj.local_uuid)
        _create_mcp_session(obj, self.request.user, "milestone_check", "MilestoneCheck")
        if obj.any_warning_sign:
            _trigger_mcp_risk_assessment(obj, obj.patient, self.request.user, "child", "milestone_check")


class ImmunizationRecordViewSet(viewsets.ModelViewSet):
    serializer_class = ImmunizationRecordSerializer
    filterset_fields = ["patient", "vaccine_name", "status"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]
    throttle_scope = "mcp_write"

    def get_queryset(self):
        patient_ids = for_user_geography(Patient.objects.all(), self.request.user).values("id")
        return ImmunizationRecord.objects.select_related("patient").filter(patient_id__in=patient_ids)

    def perform_create(self, serializer):
        obj = serializer.save(asha_worker=self.request.user)
        audit(self.request, "mcp.immunization.create", "ImmunizationRecord", obj.local_uuid)
        _create_mcp_session(obj, self.request.user, "immunization_update", "ImmunizationRecord")
        _create_incentive(obj, self.request.user)
        if obj.status in ("given", "overdue"):
            _trigger_mcp_risk_assessment(obj, obj.patient, self.request.user, "child", "immunization_update")

    @action(detail=False, methods=["get"])
    def due_today(self, request):
        patient_ids = for_user_geography(Patient.objects.all(), request.user).values("id")
        qs = self.get_queryset().filter(
            patient_id__in=patient_ids,
            scheduled_date=date.today(),
            status="due",
        )
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


class IFAComplianceViewSet(viewsets.ModelViewSet):
    serializer_class = IFAComplianceSerializer
    filterset_fields = ["patient", "year_month", "dose_given"]
    throttle_scope = "mcp_write"

    def get_queryset(self):
        patient_ids = for_user_geography(Patient.objects.all(), self.request.user).values("id")
        return IFACompliance.objects.select_related("patient").filter(patient_id__in=patient_ids)

    def perform_create(self, serializer):
        obj = serializer.save(asha_worker=self.request.user)
        audit(self.request, "mcp.ifa_compliance.create", "IFACompliance", obj.local_uuid)


class MCPSurveySessionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = MCPSurveySessionSerializer
    filterset_fields = ["patient", "session_type"]
    throttle_scope = "mcp_write"

    def get_queryset(self):
        patient_ids = for_user_geography(Patient.objects.all(), self.request.user).values("id")
        return MCPSurveySession.objects.select_related("patient").filter(patient_id__in=patient_ids)
