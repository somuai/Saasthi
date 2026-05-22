import json
import logging

import firebase_admin
from django.conf import settings
from firebase_admin import auth as firebase_auth

logger = logging.getLogger(__name__)

_app = None


def _load_credentials():
    """Try env-var JSON first, then file path, finally None."""
    raw = settings.FIREBASE_SERVICE_ACCOUNT_JSON
    if raw:
        try:
            return json.loads(raw)
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
        return None
    try:
        return firebase_auth.verify_id_token(id_token)
    except Exception as e:
        logger.error("Firebase token verification failed: %s", e)
        return None
