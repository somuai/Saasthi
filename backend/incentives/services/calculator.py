import logging

from django.contrib.auth import get_user_model
from django.utils import timezone

from incentives.models import IncentiveLedgerEntry, IncentiveRate

logger = logging.getLogger(__name__)

User = get_user_model()


class IncentiveCalculatorService:
    """
    Monthly incentive calculator that queries MCP records and matches
    completed work against configured incentive rates.

    Designed to be run via Celery beat on the 1st of each month.
    """

    def __init__(self, year, month):
        self.year = year
        self.month = month
        self.month_year = f"{year}-{month:02d}"

    def calculate_for_worker(self, worker):
        created = []

        rate_map = self._get_rate_map()
        month_start = timezone.datetime(self.year, self.month, 1, tzinfo=timezone.get_current_timezone())
        month_end = self._next_month_start() - timezone.timedelta(seconds=1)

        created += self._process_anc_registrations(worker, month_start, month_end, rate_map)
        created += self._process_deliveries(worker, month_start, month_end, rate_map)
        created += self._process_pnc_visits(worker, month_start, month_end, rate_map)
        created += self._process_immunizations(worker, month_start, month_end, rate_map)

        logger.info(
            "Calculator: worker %s month %s: created %d incentives",
            worker.pk,
            self.month_year,
            len(created),
        )
        return created

    def calculate_all(self):
        workers = User.objects.filter(
            role=User.Role.HEALTH_WORKER,
            is_active=True,
        ).iterator(chunk_size=100)

        total_created = 0
        for worker in workers:
            try:
                created = self.calculate_for_worker(worker)
                total_created += len(created)
            except Exception:
                logger.exception("Calculator failed for worker %s", worker.pk)

        logger.info("Calculator: month %s total created: %d", self.month_year, total_created)
        return total_created

    def _get_rate_map(self):
        rates = IncentiveRate.objects.filter(is_active=True).values_list("activity_type", "amount_paise")
        return dict(rates)

    def _next_month_start(self):
        if self.month == 12:
            return timezone.datetime(self.year + 1, 1, 1, tzinfo=timezone.get_current_timezone())
        return timezone.datetime(self.year, self.month + 1, 1, tzinfo=timezone.get_current_timezone())

    def _existing_refs(self, activity_type, worker):
        return set(
            IncentiveLedgerEntry.objects.filter(
                worker=worker,
                activity_type=activity_type,
                month_year=self.month_year,
            ).values_list("reference_id", flat=True)
        )

    def _create_entry(
        self, worker, activity_type, amount_paise, reference_id, reference_type, description_en="", description_hi=""
    ):
        return IncentiveLedgerEntry.objects.create(
            worker=worker,
            activity_type=activity_type,
            amount_paise=amount_paise,
            status=IncentiveLedgerEntry.Status.PENDING,
            reference_id=reference_id,
            reference_type=reference_type,
            month_year=self.month_year,
            description_en=description_en,
            description_hi=description_hi,
        )

    def _process_anc_registrations(self, worker, month_start, month_end, rate_map):
        created = []
        rate = rate_map.get("anc_registration")
        if not rate:
            return created
        try:
            from registry.models import Patient

            registrations = Patient.objects.filter(
                created_by=worker,
                created_at__gte=month_start,
                created_at__lte=month_end,
            )
            existing = self._existing_refs("anc_registration", worker)
            for patient in registrations:
                ref_id = str(patient.local_uuid)
                if ref_id in existing:
                    continue
                entry = self._create_entry(
                    worker,
                    "anc_registration",
                    rate,
                    ref_id,
                    "Patient",
                    description_en=f"ANC registration for {patient.get_name() or 'patient'}",
                    description_hi="एएनसी पंजीकरण",
                )
                created.append(entry)
        except Exception:
            logger.exception("ANC registration processing failed for worker %s", worker.pk)
        return created

    def _process_deliveries(self, worker, month_start, month_end, rate_map):
        created = []
        rate = rate_map.get("institutional_delivery")
        if not rate:
            return created
        try:
            from mcp.models import DeliveryRecord

            deliveries = DeliveryRecord.objects.filter(
                created_by=worker,
                delivery_date__gte=month_start,
                delivery_date__lte=month_end,
            )
            existing = self._existing_refs("institutional_delivery", worker)
            for delivery in deliveries:
                ref_id = str(delivery.local_uuid)
                if ref_id in existing:
                    continue
                entry = self._create_entry(
                    worker,
                    "institutional_delivery",
                    rate,
                    ref_id,
                    "DeliveryRecord",
                    description_en="Institutional delivery facilitation",
                    description_hi="संस्थागत प्रसव सुनिश्चित करना",
                )
                created.append(entry)
        except Exception:
            logger.exception("Delivery processing failed for worker %s", worker.pk)
        return created

    def _process_pnc_visits(self, worker, month_start, month_end, rate_map):
        created = []
        rate = rate_map.get("newborn_home_visits")
        if not rate:
            return created
        try:
            from mcp.models import PNCVisit

            visits = PNCVisit.objects.filter(
                created_by=worker,
                visit_date__gte=month_start,
                visit_date__lte=month_end,
            )
            existing = self._existing_refs("newborn_home_visits", worker)
            for visit in visits:
                ref_id = str(visit.local_uuid)
                if ref_id in existing:
                    continue
                entry = self._create_entry(
                    worker,
                    "newborn_home_visits",
                    rate,
                    ref_id,
                    "PNCVisit",
                    description_en="Newborn and postpartum home visit",
                    description_hi="नवजात और प्रसवोत्तर गृह भेंट",
                )
                created.append(entry)
        except Exception:
            logger.exception("PNC visit processing failed for worker %s", worker.pk)
        return created

    def _process_immunizations(self, worker, month_start, month_end, rate_map):
        created = []
        full_imm_rate = rate_map.get("full_immunization_1y")
        try:
            from mcp.models import ImmunizationRecord

            records = ImmunizationRecord.objects.filter(
                created_by=worker,
                administered_date__gte=month_start,
                administered_date__lte=month_end,
            )
            existing_full = self._existing_refs("full_immunization_1y", worker)
            for record in records:
                ref_id = str(record.local_uuid)
                if full_imm_rate and ref_id not in existing_full:
                    is_complete = getattr(record, "is_complete", False) or getattr(record, "fully_immunized", False)
                    if is_complete:
                        entry = self._create_entry(
                            worker,
                            "full_immunization_1y",
                            full_imm_rate,
                            ref_id,
                            "ImmunizationRecord",
                            description_en="Full immunization under 1 year",
                            description_hi="1 वर्ष से कम उम्र का पूर्ण टीकाकरण",
                        )
                        created.append(entry)
        except Exception:
            logger.exception("Immunization processing failed for worker %s", worker.pk)
        return created
