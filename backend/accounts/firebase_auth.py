import json
import logging

import firebase_admin
from django.conf import settings
from firebase_admin import auth as firebase_auth
from rest_framework import exceptions, status
from rest_framework.exceptions import APIException

logger = logging.getLogger(__name__)

_app = None


class ServiceUnavailable(APIException):
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = "Verification service error."
    default_code = "service_unavailable"


def _load_credentials():
    """Try env-var JSON first, then file path, finally None."""
    raw = settings.FIREBASE_SERVICE_ACCOUNT_JSON
    if raw:
        # Strip wrapping quotes if they were preserved by the env parser
        cleaned = raw.strip()
        if (cleaned.startswith("'") and cleaned.endswith("'")) or (cleaned.startswith('"') and cleaned.endswith('"')):
            cleaned = cleaned[1:-1].strip()
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            logger.warning("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON, trying file path")
    path = getattr(settings, "FIREBASE_SERVICE_ACCOUNT_PATH", None)
    if path:
        try:
            with open(path) as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError) as e:
            logger.warning("Could not load Firebase creds from %s: %s", path, e)
    return None


def _get_app():
    global _app
    if _app is None:
        cred_dict = _load_credentials()
        if cred_dict:
            try:
                cred = firebase_admin.credentials.Certificate(cred_dict)
                _app = firebase_admin.initialize_app(cred)
                logger.info("Firebase Admin SDK initialized")
            except Exception as e:
                logger.error("Firebase Admin SDK init failed: %s", e)
        else:
            logger.warning("Firebase credentials not configured — firebase auth disabled")
    return _app


def verify_firebase_token(id_token):
    app = _get_app()
    if not app:
        raise ServiceUnavailable("Firebase credentials not configured — firebase auth disabled")
    try:
        return firebase_auth.verify_id_token(id_token, check_revoked=True)
    except firebase_auth.ExpiredIdTokenError as e:
        raise exceptions.AuthenticationFailed("Session expired. Please try again.") from e
    except firebase_auth.RevokedIdTokenError as e:
        raise exceptions.AuthenticationFailed("Session revoked. Please log in again.") from e
    except (firebase_auth.InvalidIdTokenError, ValueError) as e:
        raise exceptions.AuthenticationFailed("Invalid verification.") from e
    except Exception as e:
        logger.error("Firebase token verification failed: %s", e)
        raise ServiceUnavailable("Verification service error.") from e


def verify_firebase_pnv_token(pnv_token, phone_hint=""):
    """
    Verify a Firebase Phone Number Verification token.

    PNV is an Android-only carrier verification flow. The backend must never
    accept a decoded client-side payload without signature verification, so this
    stays unavailable until the Firebase PNV verifier is explicitly configured.
    A tightly scoped test-token path exists only for local DEBUG runs.
    """
    if not settings.FIREBASE_PNV_ENABLED:
        raise ServiceUnavailable("Firebase phone number verification is not enabled.")

    if settings.FIREBASE_PNV_ACCEPT_TEST_TOKENS and pnv_token.startswith("test:"):
        token_phone = pnv_token.removeprefix("test:").strip()
        expected = phone_hint.strip()
        if expected and token_phone != expected:
            raise exceptions.AuthenticationFailed("PNV test token phone mismatch.")
        return {"phone_number": token_phone, "provider": "firebase_pnv_test"}

    raise ServiceUnavailable("Firebase PNV backend verifier is not configured.")
