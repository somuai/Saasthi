import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30, name="incentives.create_incentive")
def create_incentive(self, activity_type, worker_id, amount_paise, reference_id, reference_type, month_year, description_en="", description_hi=""):
    from django.contrib.auth import get_user_model
    from django.utils import timezone

    from .models import IncentiveLedgerEntry

    user_model = get_user_model()
    try:
        worker = user_model.objects.filter(pk=worker_id).first()
        if not worker:
            logger.warning("create_incentive: worker %s not found", worker_id)
            return

        existing = IncentiveLedgerEntry.objects.filter(
            reference_id=reference_id,
            reference_type=reference_type,
            activity_type=activity_type,
        ).exists()
        if existing:
            logger.info("create_incentive: duplicate skipped for %s %s", reference_type, reference_id)
            return

        entry = IncentiveLedgerEntry.objects.create(
            worker=worker,
            activity_type=activity_type,
            amount_paise=amount_paise,
            status=IncentiveLedgerEntry.Status.PENDING,
            reference_id=reference_id,
            reference_type=reference_type,
            month_year=month_year or timezone.now().strftime("%Y-%m"),
            description_en=description_en or "",
            description_hi=description_hi or "",
        )
        logger.info("create_incentive: created %s for worker %s", entry.local_uuid, worker_id)
    except Exception as exc:
        logger.exception("create_incentive failed for %s %s", reference_type, reference_id)
        raise self.retry(exc=exc)
