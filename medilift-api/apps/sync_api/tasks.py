from celery import shared_task


@shared_task
def ping():
    return "ok"


@shared_task
def rescore_all_patients():
    """Weekly batch rescore placeholder — wire to ORM + sklearn when RF model exists."""
    return {"status": "scheduled"}


@shared_task
def rollup_incentives():
    return {"status": "scheduled"}
