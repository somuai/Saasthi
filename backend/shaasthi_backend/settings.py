import logging
import os
import secrets
import sys
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# ── Production safety checks ────────────────────────────────────────────
_SECRET_KEY = os.getenv("DJANGO_SECRET_KEY")
_INSECURE_DEV = False
if not _SECRET_KEY:
    if os.getenv("DJANGO_ALLOW_INSECURE_DEV", "false").lower() in {"1","true","yes"}:
        _SECRET_KEY = secrets.token_urlsafe(50)
        _INSECURE_DEV = True
        print("WARNING: Using runtime-generated dev SECRET_KEY (sessions invalidated on restart). Set DJANGO_SECRET_KEY for persistence.", file=sys.stderr)
    else:
        print("FATAL: DJANGO_SECRET_KEY must be set in the environment.", file=sys.stderr)
        sys.exit(1)
_DEBUG_VALUE = os.getenv("DJANGO_DEBUG", "false").lower() in {"1", "true", "yes"}
if _DEBUG_VALUE is False and _INSECURE_DEV:
    print("FATAL: DJANGO_SECRET_KEY must be set to a unique value in production.", file=sys.stderr)
    sys.exit(1)
if not _INSECURE_DEV and _DEBUG_VALUE:
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
APP_VERSION = os.getenv("APP_VERSION", "0.1.0")

if _SENTRY_DSN and not DEBUG:
    import sentry_sdk
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration
    from sentry_sdk.integrations.redis import RedisIntegration

    sentry_sdk.init(
        dsn=_SENTRY_DSN,
        release=APP_VERSION,
        environment=os.getenv("SENTRY_ENVIRONMENT", "production"),
        traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        send_default_pii=False,
        integrations=[
            DjangoIntegration(),
            CeleryIntegration(),
            RedisIntegration(),
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
    "rest_framework_simplejwt.token_blacklist",
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
    "shaasthi_backend.middleware.RequestIDMiddleware",
    "shaasthi_backend.middleware.RequestLoggingMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
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
        name = db_path if db_path == ":memory:" or db_path.startswith("/") else str(BASE_DIR / db_path)
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
            "CONN_HEALTH_CHECKS": True,
            "OPTIONS": {
                "connect_timeout": int(os.getenv("DB_CONNECT_TIMEOUT", "10")),
            },
        }
    return {"ENGINE": "django.db.backends.sqlite3", "NAME": BASE_DIR / "db.sqlite3"}


DATABASES = {"default": database_from_url(os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'db.sqlite3'}"))}

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
TIME_ZONE = "Asia/Kolkata"
USE_I18N = True
USE_TZ = True

# ── HTTPS / Security (production only) ──────────────────────
if not DEBUG:
    SECURE_SSL_REDIRECT = os.getenv("SECURE_SSL_REDIRECT", "true").lower() in {"1", "true"}
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(os.getenv("SECURE_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

CSRF_TRUSTED_ORIGINS = [origin.strip() for origin in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",") if origin.strip()]

# ── Static & Media files ────────────────────────────────────
STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}
WHITENOISE_MAX_AGE = 31536000 if not DEBUG else 0
MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"

# ── Upload limits ───────────────────────────────────────────
DATA_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024  # 5 MB
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024  # 5 MB

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ("rest_framework_simplejwt.authentication.JWTAuthentication",),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_FILTER_BACKENDS": ("django_filters.rest_framework.DjangoFilterBackend",),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_THROTTLE_CLASSES": ("rest_framework.throttling.ScopedRateThrottle",),
    "DEFAULT_THROTTLE_RATES": {
        "otp": os.getenv("THROTTLE_OTP", "5/min"),
        "sync_push": os.getenv("THROTTLE_SYNC_PUSH", "60/min"),
        "sync_pull": os.getenv("THROTTLE_SYNC_PULL", "10/min"),
        "survey_write": os.getenv("THROTTLE_SURVEY_WRITE", "10/min"),
        "risk_assess": os.getenv("THROTTLE_RISK_ASSESS", "30/min"),
        "gemma_query": os.getenv("THROTTLE_GEMMA_QUERY", "10/min"),
        "visit_records": os.getenv("THROTTLE_VISIT_RECORDS", "30/min"),
        "followups": os.getenv("THROTTLE_FOLLOWUPS", "30/min"),
        "user_management": os.getenv("THROTTLE_USER_MANAGEMENT", "30/min"),
        "worker_registration": os.getenv("THROTTLE_WORKER_REGISTRATION", "10/min"),
        "registry_write": os.getenv("THROTTLE_REGISTRY_WRITE", "30/min"),
        "flagging": os.getenv("THROTTLE_FLAGGING", "30/min"),
        "referrals": os.getenv("THROTTLE_REFERRALS", "30/min"),
        "incentives": os.getenv("THROTTLE_INCENTIVES", "10/min"),
        "analytics": os.getenv("THROTTLE_ANALYTICS", "20/min"),
        "notifications": os.getenv("THROTTLE_NOTIFICATIONS", "30/min"),
        "mcp_write": os.getenv("THROTTLE_MCP_WRITE", "30/min"),
        "risk_rules": os.getenv("THROTTLE_RISK_RULES", "10/min"),
    },
    "EXCEPTION_HANDLER": "shaasthi_backend.exceptions.custom_exception_handler",
}

if not DEBUG:
    REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"] = ("rest_framework.renderers.JSONRenderer",)

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=6),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Shaasthi Pilot API",
    "DESCRIPTION": "Backend API for the Shaasthi pilot MVP.",
    "VERSION": "0.1.0",
}

OTP_TTL_MINUTES = int(os.getenv("OTP_TTL_MINUTES", "10"))
EXPOSE_DEBUG_OTP = os.getenv("EXPOSE_DEBUG_OTP", "true" if DEBUG else "false").lower() in {"1", "true", "yes"}

# GPS verification
GPS_ACCEPTABLE_RADIUS_M = int(os.getenv("GPS_ACCEPTABLE_RADIUS_M", "200"))
GPS_WARNING_RADIUS_M = int(os.getenv("GPS_WARNING_RADIUS_M", "500"))

# SMS delivery via Firebase (legacy MSG91 removed)

# Firebase Admin SDK — supports env-var JSON or file path
FIREBASE_SERVICE_ACCOUNT_JSON = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
FIREBASE_SERVICE_ACCOUNT_PATH = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)
CELERY_BROKER_POOL_LIMIT = int(os.getenv("CELERY_BROKER_POOL_LIMIT", "20"))
CELERY_BROKER_CONNECTION_TIMEOUT = int(os.getenv("CELERY_BROKER_CONNECTION_TIMEOUT", "5"))
CELERY_TASK_ALWAYS_EAGER = os.getenv("CELERY_TASK_ALWAYS_EAGER", "false").lower() in {"1", "true", "yes"}
CELERY_TIMEZONE = "Asia/Kolkata"
CELERY_TASK_ROUTES = {
    "risk_engine.run_risk_assessment": {"queue": "risk_assessment"},
    "risk_engine.run_mcp_risk_assessment": {"queue": "risk_assessment"},
}
CELERY_TASK_ANNOTATIONS = {
    "risk_engine.run_risk_assessment": {"rate_limit": "100/s"},
}
CELERY_TASK_ACKS_LATE = True
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERY_TASK_SOFT_TIME_LIMIT = int(os.getenv("CELERY_TASK_SOFT_TIME_LIMIT", "300"))
CELERY_TASK_TIME_LIMIT = int(os.getenv("CELERY_TASK_TIME_LIMIT", "600"))
CELERY_RESULT_EXPIRES = int(os.getenv("CELERY_RESULT_EXPIRES", "86400"))

# ── Cache ───────────────────────────────────────────────────
if DEBUG:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "KEY_PREFIX": "shaasthi",
            "TIMEOUT": 300,
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
            "KEY_PREFIX": "shaasthi",
            "TIMEOUT": 300,
            "OPTIONS": {
                "MAX_CONNECTIONS": int(os.getenv("REDIS_CACHE_MAX_CONNECTIONS", "50")),
            },
        }
    }

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
