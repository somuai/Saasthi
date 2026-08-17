import csv

from accounts.models import User
from django.db.models import Q
from django.http import HttpResponse
from mcp.models import ANCVisit, DeliveryRecord, GrowthRecord, ImmunizationRecord, PNCVisit
from registry.models import Patient
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from shaasthi_backend.querysets import for_user_geography


class HMISReportExportView(APIView):
    """Generate a compliant NHM HMIS/MCTS aggregated CSV report.

    Aggregates key maternal and child health indicators by village.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        allowed_roles = {
            User.Role.ADMIN,
            User.Role.AUDITOR,
            "state_admin",
            "district_officer",
            "block_manager",
            User.Role.SUPERVISOR,
        }
        if request.user.role not in allowed_roles:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Access restricted to administrative and supervisor roles.")

        # Scope patients by geography
        patients = for_user_geography(Patient.objects.all(), request.user)

        # Parse optional date parameters
        start_date = request.query_params.get("start_date")
        end_date = request.query_params.get("end_date")

        # Get the unique villages matching the geography scope
        villages = patients.values_list("village", flat=True).distinct()

        # Create the HttpResponse with the CSV headers
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="nhm-hmis-compliance-report.csv"'

        writer = csv.writer(response)
        headers = [
            "Village Name",
            "Total Registrations",
            "Total Pregnant Women",
            "High Risk Pregnancies",
            "ANC Visit 1 (Registration)",
            "ANC Visit 4 Check",
            "Total ANC Visits",
            "Institutional Deliveries",
            "Home Deliveries",
            "Total Deliveries",
            "Live Births",
            "Still Births",
            "PNC Visits Conducted",
            "Immunizations Administered",
            "Growth Falters Identified",
        ]
        writer.writerow(headers)

        for village in villages:
            if not village:
                continue

            village_patients = patients.filter(village=village)
            patient_ids = village_patients.values_list("id", flat=True)

            # Build query filters
            anc_q = Q(patient_id__in=patient_ids)
            delivery_q = Q(mother_patient_id__in=patient_ids)
            pnc_q = Q(mother_patient_id__in=patient_ids)
            immu_q = Q(patient_id__in=patient_ids, status="given")
            growth_q = Q(patient_id__in=patient_ids)

            if start_date:
                anc_q &= Q(visit_date__gte=start_date)
                delivery_q &= Q(delivery_date__gte=start_date)
                pnc_q &= Q(visit_date__gte=start_date)
                immu_q &= Q(administered_date__gte=start_date)
                growth_q &= Q(recorded_date__gte=start_date)
            if end_date:
                anc_q &= Q(visit_date__lte=end_date)
                delivery_q &= Q(delivery_date__lte=end_date)
                pnc_q &= Q(visit_date__lte=end_date)
                immu_q &= Q(administered_date__lte=end_date)
                growth_q &= Q(recorded_date__lte=end_date)

            # Aggregate stats
            tot_patients = village_patients.count()
            tot_preg = village_patients.filter(pregnancy_status=True).count()
            tot_hr_preg = village_patients.filter(pregnancy_status=True, is_high_risk_pregnancy=True).count()

            anc1 = ANCVisit.objects.filter(anc_q, visit_number=1).count()
            anc4 = ANCVisit.objects.filter(anc_q, visit_number=4).count()
            total_anc = ANCVisit.objects.filter(anc_q).count()

            inst_del = DeliveryRecord.objects.filter(delivery_q, delivery_place="institution").count()
            home_del = DeliveryRecord.objects.filter(delivery_q, delivery_place="home").count()
            total_del = DeliveryRecord.objects.filter(delivery_q).count()

            live_births = DeliveryRecord.objects.filter(delivery_q, delivery_outcome="live_birth").count()
            still_births = DeliveryRecord.objects.filter(delivery_q, delivery_outcome="still_birth").count()

            total_pnc = PNCVisit.objects.filter(pnc_q).count()
            total_immu = ImmunizationRecord.objects.filter(immu_q).count()
            total_falters = GrowthRecord.objects.filter(growth_q, is_faltering=True).count()

            writer.writerow(
                [
                    village,
                    tot_patients,
                    tot_preg,
                    tot_hr_preg,
                    anc1,
                    anc4,
                    total_anc,
                    inst_del,
                    home_del,
                    total_del,
                    live_births,
                    still_births,
                    total_pnc,
                    total_immu,
                    total_falters,
                ]
            )

        return response
