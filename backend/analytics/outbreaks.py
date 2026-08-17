import logging
from collections import defaultdict
from datetime import timedelta

from accounts.models import User
from django.db.models import Avg
from django.utils import timezone
from registry.models import Household, Patient
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from risk_engine.models import RiskAssessment
from shaasthi_backend.querysets import for_user_geography

logger = logging.getLogger(__name__)


def get_village_coords(village_name):
    """Retrieve average lat/lng for a village from Household data, defaulting to WB center."""
    coords = Household.objects.filter(village=village_name, lat__isnull=False, lng__isnull=False).aggregate(
        avg_lat=Avg("lat"), avg_lng=Avg("lng")
    )

    if coords["avg_lat"] is not None and coords["avg_lng"] is not None:
        return coords["avg_lat"], coords["avg_lng"]

    # Default fallback to center of pilot region in West Bengal if coordinates are missing
    return 22.9868, 87.8550


class OutbreakAlertView(APIView):
    """API view to detect disease clusters in the last 14 days.

    If 3 or more patients in the same village present the same symptom/factor
    in the last 14 days, an active outbreak alert is generated.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Enforce administrative/supervisor access
        allowed_roles = {
            User.Role.ADMIN,
            User.Role.AUDITOR,
            "state_admin",
            "district_officer",
            "block_manager",
            User.Role.SUPERVISOR,
        }
        if request.user.role not in allowed_roles:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Access restricted to administrative and supervisor roles.")

        # Resolve geographic scope
        patients = for_user_geography(Patient.objects.all(), request.user)

        # Retrieve risk assessments from last 14 days
        cutoff = timezone.now() - timedelta(days=14)
        assessments = RiskAssessment.objects.filter(patient__in=patients, created_at__gte=cutoff).select_related(
            "patient"
        )

        # Group by (village, symptom_code)
        clusters = defaultdict(list)
        for ass in assessments:
            if not ass.patient or not ass.patient.village:
                continue

            village = ass.patient.village
            explanations = ass.explanations or []
            if not isinstance(explanations, list):
                continue

            for exp in explanations:
                if not isinstance(exp, dict):
                    continue
                code = exp.get("code")
                if not code:
                    continue

                clusters[(village, code)].append(
                    {
                        "patient_id": ass.patient.id,
                        "created_at": ass.created_at,
                        "symptom_label": exp.get("rule_label_en") or exp.get("name") or code,
                    }
                )

        active_alerts = []
        for (village, code), cases in clusters.items():
            # Count unique patients to avoid double counting the same patient
            unique_patient_ids = list({c["patient_id"] for c in cases})
            if len(unique_patient_ids) >= 3:
                lat, lng = get_village_coords(village)
                latest_time = max(c["created_at"] for c in cases)
                symptom_label = cases[0]["symptom_label"]

                active_alerts.append(
                    {
                        "village": village,
                        "symptom": code,
                        "symptom_label": symptom_label,
                        "case_count": len(unique_patient_ids),
                        "lat": lat,
                        "lng": lng,
                        "patient_ids": unique_patient_ids,
                        "last_reported_at": latest_time.isoformat(),
                    }
                )

        # Sort by case count descending
        active_alerts.sort(key=lambda x: x["case_count"], reverse=True)

        return Response({"outbreaks": active_alerts})
