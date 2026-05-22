import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "shaasthi_backend.settings")

app = Celery("shaasthi_workers")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
