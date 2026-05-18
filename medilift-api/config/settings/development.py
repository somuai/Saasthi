import os
import re

from .base import *  # noqa

DEBUG = True

_db_url = os.getenv("DATABASE_URL")
if _db_url and _db_url.startswith("postgres"):
    m = re.match(r"postgres://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)", _db_url)
    if m:
        user, password, host, port, name = m.groups()
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.postgresql",
                "NAME": name,
                "USER": user,
                "PASSWORD": password,
                "HOST": host,
                "PORT": port,
            }
        }
