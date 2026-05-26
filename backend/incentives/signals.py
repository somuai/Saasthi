import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


def _get_rate(activity_type):
    try:
        from .models import IncentiveRate

        rate = IncentiveRate.objects.filter(activity_type=activity_type, is_active=True).first()
        if rate:
            return rate.amount_paise
    except Exception:
        logger.exception("Failed to fetch rate for %s", activity_type)
    return None


def _month_year_now():
    from django.utils import timezone

    return timezone.now().strftime("%Y-%m")


@receiver(post_save, sender="surveys.SurveyResponse")
def auto_incentive_on_survey(sender, instance, created, **kwargs):
    if not created:
        return
    if not instance.created_by:
        return
    rate = _get_rate("survey_completion")
    if not rate:
        return
    from .tasks import create_incentive

    create_incentive.delay(
        activity_type="survey_completion",
        worker_id=instance.created_by.pk,
        amount_paise=rate,
        reference_id=str(instance.local_uuid),
        reference_type="SurveyResponse",
        month_year=_month_year_now(),
        description_en="Survey completion incentive",
        description_hi="सर्वेक्षण पूर्णता प्रोत्साहन",
    )


@receiver(post_save, sender="flagging.Flag")
def auto_incentive_on_flag(sender, instance, created, **kwargs):
    if not created:
        return
    worker = getattr(instance, "created_by", None)
    if not worker:
        return

    if instance.flag_type in ("hard_flag", "hard_flag_referral", "high_risk_referral"):
        activity_type = "hard_flag_referral"
    elif instance.flag_type in ("high_risk", "clinical_risk") and instance.severity in ("high", "critical"):
        activity_type = "high_risk_identification"
    else:
        return

    rate = _get_rate(activity_type)
    if not rate:
        return
    from .tasks import create_incentive

    create_incentive.delay(
        activity_type=activity_type,
        worker_id=worker.pk,
        amount_paise=rate,
        reference_id=str(instance.local_uuid),
        reference_type="Flag",
        month_year=_month_year_now(),
        description_en=f"Incentive for {instance.get_flag_type_display() if hasattr(instance, 'get_flag_type_display') else instance.flag_type}",
        description_hi="फ्लैग प्रोत्साहन",
    )


@receiver(post_save, sender="followups.FollowUp")
def auto_incentive_on_followup(sender, instance, **kwargs):
    if instance.status != "completed":
        return
    if not instance.worker:
        return
    if instance.incentive_claimed:
        return

    rate = _get_rate("followup_completed_on_time")
    if not rate:
        return
    from .tasks import create_incentive

    create_incentive.delay(
        activity_type="followup_completed_on_time",
        worker_id=instance.worker.pk,
        amount_paise=rate,
        reference_id=str(instance.local_uuid),
        reference_type="FollowUp",
        month_year=instance.scheduled_date.strftime("%Y-%m") if instance.scheduled_date else _month_year_now(),
        description_en="Follow-up completed on time incentive",
        description_hi="समय पर अनुवर्तन पूर्णता प्रोत्साहन",
    )

    instance.incentive_claimed = True
    instance.save(update_fields=["incentive_claimed"])
