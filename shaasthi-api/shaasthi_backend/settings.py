import logging
import os
import sys
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# ── Production safety checks ────────────────────────────────────────────
_SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "shaasthi-dev-secret")
_DEBUG_VALUE = os.getenv("DJANGO_DEBUG", "true").lower() in {"1", "true", "yes"}
if _DEBUG_VALUE is False and _SECRET_KEY == "shaasthi-dev-secret":
    print("FATAL: DJANGO_SECRET_KEY must be set to a unique value in production.", file=sys.stderr)
    sys.exit(1)
if _SECRET_KEY != "shaasthi-dev-secret" and _DEBUG_VALUE:
    print("WARNING: DJANGO_DEBUG is enabled with a custom SECRET_KEY. Disable in production.", file=sys.stderr)

SECRET_KEY = _SECRET_KEY
DEBUG = _DEBUG_VALUE
_ALLOWED_HOSTS_RAW = os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1,testserver")
ALLOWED_HOSTS = [host.strip() for host in _ALLOWED_HOSTS_RAW.split(",") if host.strip()]
_DEFAULT_HOSTS = {"localhost", "127.0.0.1", "testserver", "*"}
if _DEBUG_VALUE is False and set(ALLOWED_HOSTS) <= _DEFAULT_HOSTS:
    print("FATAL: DJANGO_ALLOWED_HOSTS must be set to production domains.", file=sys.stderr)
    sys.exit(1)

# ── Sentry (production only) ────────────────────────────────────────────
_SENTRY_DSN = os.getenv("SENTRY_DSN")
if _SENTRY_DSN and not DEBUG:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration

    sentry_sdk.init(
        dsn=_SENTRY_DSN,
        environment=os.getenv("SENTRY_ENVIRONMENT", "production"),
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        send_default_pii=False,
        integrations=[
            DjangoIntegration(),
            LoggingIntegration(level=logging.WARNING, event_level=logging.ERROR),
        ],
    )

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "django_filters",
    "drf_spectacular",
    "corsheaders",
    "accounts",
    "registry",
    "surveys",
    "mcp",
    "sync",
    "risk_engine",
    "flagging",
    "referrals",
    "incentives",
    "analytics",
    "notifications",
    "followups",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "shaasthi_backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "shaasthi_backend.wsgi.application"
AUTH_USER_MODEL = "accounts.User"


def database_from_url(url):
    if url.startswith("sqlite:///"):
        db_path = url.removeprefix("sqlite:///")
        if db_path == ":memory:" or db_path.startswith("/"):
            name = db_path
        else:
            name = str(BASE_DIR / db_path)
        return {"ENGINE": "django.db.backends.sqlite3", "NAME": name}
    parsed = urlparse(url)
    if parsed.scheme in {"postgres", "postgresql"}:
        return {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": parsed.path.lstrip("/"),
            "USER": parsed.username,
            "PASSWORD": parsed.password,
            "HOST": parsed.hostname,
            "PORT": parsed.port or 5432,
            "CONN_MAX_AGE": int(os.getenv("DB_CONN_MAX_AGE", "60")),
            "OPTIONS": {
                "connect_timeout": int(os.getenv("DB_CONNECT_TIMEOUT", "10")),
            },
        }
    return {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}


DATABASES = {
    "default": database_from_url(os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'db.sqlite3'}"))
}

# ── CORS ────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "http://localhost:8081,http://127.0.0.1:8081").split(",")
    if origin.strip()
]
CORS_ALLOW_CREDENTIALS = True
CORS_URLS_REGEX = r"^/api/.*$"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ("rest_framework_simplejwt.authentication.JWTAuthentication",),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_FILTER_BACKENDS": ("django_filters.rest_framework.DjangoFilterBackend",),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_THROTTLE_RATES": {
        "otp": os.getenv("THROTTLE_OTP", "5/min"),
    },
    "DEFAULT_THROTTLE_CLASSES": (),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=6),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Shaasthi Pilot API",
    "DESCRIPTION": "Backend API for the Shaasthi pilot MVP.",
    "VERSION": "0.1.0",
}

OTP_TTL_MINUTES = int(os.getenv("OTP_TTL_MINUTES", "10"))
EXPOSE_DEBUG_OTP = os.getenv("EXPOSE_DEBUG_OTP", "true" if DEBUG else "false").lower() in {"1", "true", "yes"}

# MSG91 SMS Provider Settings
MSG91_AUTH_KEY = os.getenv("MSG91_AUTH_KEY")
MSG91_TEMPLATE_ID = os.getenv("MSG91_TEMPLATE_ID")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)
CELERY_TASK_ALWAYS_EAGER = os.getenv("CELERY_TASK_ALWAYS_EAGER", "false").lower() in {"1", "true", "yes"}
CELERY_TIMEZONE = "Asia/Kolkata"
CELERY_TASK_ROUTES = {
    "risk_engine.run_risk_assessment": {"queue": "risk_assessment"},
}
CELERY_TASK_ANNOTATIONS = {
    "risk_engine.run_risk_assessment": {"rate_limit": "100/s"},
}
CELERY_TASK_ACKS_LATE = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1

# ── Logging ─────────────────────────────────────────────────────────────
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "json": {
            "()": "shaasthi_backend.logging_utils.JsonLogFormatter",
            "format": "%(asctime)s %(name)s %(levelname)s %(message)s",
        },
        "verbose": {
            "format": "[{asctime}] {levelname} {name} {message}",
            "style": "{",
        },
    },
    "filters": {
        "phi_redaction": {
            "()": "shaasthi_backend.logging_utils.PHIRedactionFilter",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose" if DEBUG else "json",
            "filters": ["phi_redaction"],
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "DEBUG" if DEBUG else "INFO",
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "INFO",
            "propagate": False,
        },
        "django.request": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": False,
        },
        "celery": {
            "handlers": ["console"],
            "level": "WARNING",
            "propagate": False,
        },
        "risk_engine": {
            "handlers": ["console"],
            "level": "DEBUG" if DEBUG else "INFO",
        },
    },
}
