import logging

from celery import current_app
from django.conf import settings
from django.db import connections
from drf_spectacular.utils import extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

logger = logging.getLogger(__name__)

UNHEALTHY = "unhealthy"
DEGRADED = "degraded"
HEALTHY = "healthy"


@extend_schema(responses={200: {"type": "object", "properties": {"status": {"type": "string"}}}})
@api_view(["GET"])
@permission_classes([AllowAny])
def liveness(request):
    return Response({"status": "alive"})


@extend_schema(responses={200: {"type": "object"}, 503: {"type": "object"}})
@api_view(["GET"])
@permission_classes([AllowAny])
def readiness(request):
    checks = {}
    overall = HEALTHY

    # Database
    try:
        connections["default"].cursor().execute("SELECT 1")
        checks["database"] = HEALTHY
    except Exception as exc:
        checks["database"] = UNHEALTHY
        checks["database_detail"] = str(exc)
        overall = UNHEALTHY

    # Redis (cache or broker)
    redis_ok = False
    for label, url in [
        ("redis_cache", settings.REDIS_URL),
        ("redis_broker", settings.CELERY_BROKER_URL),
    ]:
        try:
            import redis

            client = redis.from_url(url)
            client.ping()
            client.close()
            checks[label] = HEALTHY
            redis_ok = True
        except Exception as exc:
            checks[label] = UNHEALTHY
            checks[f"{label}_detail"] = str(exc)

    if not redis_ok and not settings.DEBUG:
        overall = UNHEALTHY

    return Response(
        {"status": overall, "checks": checks, "version": getattr(settings, "APP_VERSION", "0.1.0")},
        status=200 if overall != UNHEALTHY else 503,
    )


@extend_schema(responses={200: {"type": "object"}})
@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    data = {"status": "ok", "version": getattr(settings, "APP_VERSION", "0.1.0")}
    try:
        connections["default"].cursor().execute("SELECT 1")
        data["database"] = "ok"
    except Exception as exc:
        data["database"] = "error"
        data["database_detail"] = str(exc)
        data["status"] = "degraded"

    try:
        insp = current_app.control.inspect()
        ping = insp.ping()
        if ping:
            data["celery"] = "ok"
            data["celery_workers"] = list(ping.keys())
        else:
            data["celery"] = "no_workers"
            if not getattr(settings, "DEBUG", False):
                data["status"] = "degraded"
    except Exception as exc:
        data["celery"] = "error"
        data["celery_detail"] = str(exc)
        if not getattr(settings, "DEBUG", False):
            data["status"] = "degraded"

    return Response(data)


def privacy_policy_view(request):
    from django.http import HttpResponse

    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policy - Saasthi Maternal Health Platform</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #0D1B2A; border-bottom: 2px solid #E5E5E5; padding-bottom: 10px; }
        h2 { color: #1B263B; margin-top: 30px; }
        h3 { color: #415A77; }
        ul { padding-left: 20px; }
        footer { margin-top: 50px; font-size: 0.9em; color: #777; text-align: center; border-top: 1px solid #E5E5E5; padding-top: 20px; }
    </style>
</head>
<body>
    <h1>Privacy Policy - Saasthi Maternal Health Platform</h1>
    <p><strong>Effective Date:</strong> May 31, 2026</p>
    <p>The Saasthi Maternal and Child Health Platform ("Saasthi") is a mobile and web platform designed to assist Accredited Social Health Activist (ASHA) workers and clinical supervisors in rural India in delivering timely maternal care, tracking growth parameters, and coordinating child immunization schedules.</p>

    <h2>1. Scope and Applicability</h2>
    <p>This privacy policy applies strictly to the data collected, stored, and processed through the Saasthi mobile application (for ASHA workers) and the Saasthi administrative dashboard (for ANM and health supervisors). It is drafted to comply with the Google Play Store Developer Policy for Health Apps, the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011 (India), and national maternal health guidelines from the Ministry of Health and Family Welfare (MoHFW), Government of India.</p>

    <h2>2. Information We Collect</h2>
    <p>To deliver essential maternal and child care, Saasthi processes the following categories of information:</p>
    <ul>
        <li><strong>Patient Demographics:</strong> Name, age, village, block, district, and household identifiers.</li>
        <li><strong>Medical Histories and Health Data:</strong> Pregnancy details (Last Menstrual Period (LMP), Estimated Date of Delivery (EDD), parity, obstetric history), patient blood groups, chronic illnesses, infectious risk factors, child height/weight growth logs, and immunization records.</li>
        <li><strong>Geographic Location (GPS):</strong> Server-side GPS coordinates are captured at the moment of synchronization to verify ASHA visits to beneficiary households, preventing fraudulent reporting and ensuring service delivery.</li>
        <li><strong>ASHA Worker Account Information:</strong> Registration details, authenticated phone numbers, and activity logs.</li>
    </ul>

    <h2>3. Purpose and Use of Collected Data</h2>
    <p>All data collected is used solely for healthcare coordination and administrative auditing:</p>
    <ul>
        <li><strong>Care Coordination:</strong> Allowing ASHA workers to view their schedules, trace overdue follow-ups, and receive warnings regarding high-risk pregnancies.</li>
        <li><strong>Government Audits & Incentives:</strong> Supplying ANM supervisors with verified visit reports to calculate performance-based incentives for ASHA workers.</li>
        <li><strong>Service Verification:</strong> Classifying GPS coordinate distances server-side to guarantee clinical workers physically visit beneficiary households.</li>
    </ul>

    <h2>4. Data Protection and Security</h2>
    <p>We deploy rigorous security protocols to protect patient medical records:</p>
    <ul>
        <li><strong>Data Encryption in Transit:</strong> All data transmitted between the mobile application and the backend API is encrypted using secure HTTPS/TLS 1.3 tunnels.</li>
        <li><strong>Data Encryption at Rest:</strong> All databases, storage volumes, and server backups are encrypted using AES-256 standard encryption keys managed via secure key systems.</li>
        <li><strong>Geography Scoping (Access Control):</strong> Sub-district geographic filters restrict ASHA workers from viewing patient records outside their assigned villages or blocks.</li>
        <li><strong>Token-Based Session Management:</strong> Authentication is handled via secure, rotating JSON Web Tokens (JWT) and secure HTTPOnly/SameSite session cookies.</li>
    </ul>

    <h2>5. Data Sharing and Retention</h2>
    <p>We hold patient confidentiality as our highest priority:</p>
    <ul>
        <li><strong>No Commercial Sharing:</strong> We do not sell, rent, or trade patient medical records or personal data to third parties.</li>
        <li><strong>Administrative Sharing:</strong> Data is shared only with authorized public health administrators and supervisors within the National Health Mission (NHM) hierarchy.</li>
        <li><strong>Retention Policy:</strong> Records are retained securely in line with NHM and MoHFW retention directives for public health registries.</li>
    </ul>

    <h2>6. Rights and User Consent</h2>
    <p>Data is entered by designated ASHA workers under the consent guidelines of the local healthcare provider. Registered beneficiaries can contact their local ANM supervisor or reach out via <strong>privacy@saasthi.in</strong> to request correction, access, or deletion of their personal health files.</p>

    <footer>
        <p>&copy; 2026 National Health Mission (NHM) - Saasthi Project. All Rights Reserved.</p>
    </footer>
</body>
</html>"""
    return HttpResponse(html_content, content_type="text/html; charset=utf-8")
