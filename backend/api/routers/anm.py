import logging

from accounts.models import AuthSession, User, WorkerRegistration
from accounts.serializers import WorkerRegistrationSerializer
from django.db.models import Avg
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.urls import path
from django.utils import timezone
from followups.models import FollowUp
from incentives.models import IncentiveLedgerEntry
from registry.models import Household, Patient
from rest_framework import status
from rest_framework.parsers import JSONParser, MultiPartParser
from rest_framework.permissions import BasePermission, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from services.nhm_report_service import NHMReportService
from services.ocr_service import OCRService
from services.report_service import MonthlyReportService
from surveys.models import SurveyResponse

logger = logging.getLogger(__name__)


class IsANMOrAdmin(BasePermission):
    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role
            in (
                User.Role.SUPERVISOR,
                User.Role.ADMIN,
                User.Role.AUDITOR,
                User.Role.STATE_ADMIN,
                User.Role.DISTRICT_OFFICER,
                User.Role.BLOCK_MANAGER,
            )
        )


def _workers_for_user(user):
    workers = User.objects.filter(role=User.Role.HEALTH_WORKER)
    if user.is_superuser or user.role in {User.Role.ADMIN, User.Role.AUDITOR, User.Role.STATE_ADMIN}:
        return workers
    if user.role == User.Role.DISTRICT_OFFICER and user.district:
        return workers.filter(district=user.district)
    if user.role == User.Role.BLOCK_MANAGER and user.block:
        return workers.filter(block=user.block)
    if user.role == User.Role.SUPERVISOR:
        registrations = WorkerRegistration.objects.filter(supervisor=user, is_active=True)
        return workers.filter(phone__in=registrations.values_list("phone", flat=True))
    return workers.none()


def _patients_for_user(user):
    patients = Patient.objects.select_related("asha_worker", "household").prefetch_related("anc_visits")
    if user.is_superuser or user.role in {User.Role.ADMIN, User.Role.AUDITOR, User.Role.STATE_ADMIN}:
        return patients
    if user.role == User.Role.DISTRICT_OFFICER and user.district:
        return patients.filter(district=user.district)
    if user.role == User.Role.BLOCK_MANAGER and user.block:
        return patients.filter(block=user.block)
    if user.role == User.Role.SUPERVISOR:
        return patients.filter(asha_worker__in=_workers_for_user(user))
    return patients.none()


def _download_response(payload, content_type, filename):
    response = HttpResponse(payload, content_type=content_type)
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


class WorkersOverviewView(APIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]

    def get(self, request):
        supervisor = request.user
        if supervisor.role == User.Role.ADMIN or supervisor.is_superuser:
            registrations = WorkerRegistration.objects.filter(is_active=True)
        else:
            registrations = WorkerRegistration.objects.filter(supervisor=supervisor, is_active=True)
        phones = registrations.values_list("phone", flat=True)

        # Get users corresponding to these phones
        workers = User.objects.filter(phone__in=phones, role=User.Role.HEALTH_WORKER)

        from accounts.serializers import normalize_phone
        from django.db.models import Count, Max

        # Build workers_map keyed on the 10-digit phone representation
        workers_map = {}
        for w in workers:
            if w.phone:
                _, w_10 = normalize_phone(w.phone)
                workers_map[w_10] = w

        # Precompute stats to avoid N+1 queries
        worker_ids = [w.id for w in workers]

        households_counts = {
            h["created_by"]: h["count"]
            for h in Household.objects.filter(created_by__in=worker_ids)
            .values("created_by")
            .annotate(count=Count("id"))
        }

        patients_counts = {
            p["asha_worker"]: p["count"]
            for p in Patient.objects.filter(asha_worker__in=worker_ids)
            .values("asha_worker")
            .annotate(count=Count("id"))
        }

        high_risk_counts = {
            p["asha_worker"]: p["count"]
            for p in Patient.objects.filter(asha_worker__in=worker_ids, is_high_risk_pregnancy=True)
            .values("asha_worker")
            .annotate(count=Count("id"))
        }

        now = timezone.now()
        surveys_counts = {
            s["created_by"]: s["count"]
            for s in SurveyResponse.objects.filter(
                created_by__in=worker_ids, created_at__year=now.year, created_at__month=now.month
            )
            .values("created_by")
            .annotate(count=Count("id"))
        }

        followups_counts = {
            f["worker"]: f["count"]
            for f in FollowUp.objects.filter(worker__in=worker_ids, status=FollowUp.Status.PENDING)
            .values("worker")
            .annotate(count=Count("id"))
        }

        households_coords = {
            hc["created_by"]: (hc["avg_lat"], hc["avg_lng"])
            for hc in Household.objects.filter(created_by__in=worker_ids, lat__isnull=False, lng__isnull=False)
            .values("created_by")
            .annotate(avg_lat=Avg("lat"), avg_lng=Avg("lng"))
        }

        last_syncs = {
            s["worker"]: s["max_active"]
            for s in AuthSession.objects.filter(worker__in=worker_ids)
            .values("worker")
            .annotate(max_active=Max("last_active_at"))
        }

        # Calculate stats for each worker
        data = []
        for reg in registrations:
            _, reg_10 = normalize_phone(reg.phone) if reg.phone else ("", "")
            worker_user = workers_map.get(reg_10)

            # Counts
            if worker_user:
                wid = worker_user.id
                total_households = households_counts.get(wid, 0)
                total_patients = patients_counts.get(wid, 0)
                surveys_this_month = surveys_counts.get(wid, 0)
                high_risk_count = high_risk_counts.get(wid, 0)
                pending_followups = followups_counts.get(wid, 0)

                # sessions & active status
                last_sync_at_dt = last_syncs.get(wid)
                if last_sync_at_dt:
                    last_sync_at = last_sync_at_dt.isoformat()
                    delta = timezone.now() - last_sync_at_dt
                    if delta.days == 0:
                        sync_status = "today"
                    elif delta.days <= 2:
                        sync_status = "recent"
                    else:
                        sync_status = "stale"
                else:
                    last_sync_at = None
                    sync_status = "never"

                onboarding_status = "joined"
                onboarded_at = worker_user.date_joined.isoformat()

                # Average lat/lng of registered households
                lat, lng = households_coords.get(wid, (None, None))
                if lat is None or lng is None:
                    # Deterministic offset based on worker_user.id
                    lat = 22.5726 + (((worker_user.id * 17) % 100) - 50) * 0.001
                    lng = 88.3639 + (((worker_user.id * 31) % 100) - 50) * 0.001
            else:
                total_households = 0
                total_patients = 0
                surveys_this_month = 0
                high_risk_count = 0
                pending_followups = 0
                last_sync_at = None
                sync_status = "never"
                onboarding_status = "sms_sent" if reg.created_at else "not_contacted"
                onboarded_at = reg.created_at.isoformat() if reg.created_at else None

                # Deterministic offset based on registration id
                lat = 22.5726 + (((reg.id * 23) % 100) - 50) * 0.001
                lng = 88.3639 + (((reg.id * 47) % 100) - 50) * 0.001

            data.append(
                {
                    "id": worker_user.id if worker_user else None,
                    "name": reg.full_name,
                    "name_hi": worker_user.metadata.get("name_hi", "") if worker_user else "",
                    "asha_id": worker_user.username if worker_user else f"unonboarded_{reg.id}",
                    "village": reg.village,
                    "phone_number": reg.phone,
                    "is_active": reg.is_active,
                    "onboarded_at": onboarded_at,
                    "onboarding_status": onboarding_status,
                    "last_sync_at": last_sync_at,
                    "sync_status": sync_status,
                    "total_households": total_households,
                    "total_patients": total_patients,
                    "surveys_this_month": surveys_this_month,
                    "high_risk_count": high_risk_count,
                    "pending_followups": pending_followups,
                    "estimated_households": reg.estimated_households,
                    "lat": lat,
                    "lng": lng,
                }
            )

        return Response(data)


class ManualRegisterWorkerView(APIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]

    def post(self, request):
        phone_number = request.data.get("phone_number", "").strip()
        name = request.data.get("name", "").strip()
        name_hi = request.data.get("name_hi", "").strip()
        asha_id = request.data.get("asha_id", "").strip()
        village = request.data.get("village", "").strip()
        block = request.data.get("block", "").strip() or request.user.block
        district = request.data.get("district", "").strip() or request.user.district
        try:
            estimated = int(request.data.get("estimated_households", 200) or 200)
        except (TypeError, ValueError):
            return Response({"detail": "estimated_households must be an integer"}, status=400)

        if not phone_number or not name or not asha_id:
            return Response({"detail": "phone_number, name, and asha_id are required"}, status=400)

        # Standardize to canonical +91XXXXXXXXXX format
        from accounts.serializers import normalize_phone

        clean_phone, phone_10digit = normalize_phone(phone_number)
        if not (len(phone_10digit) == 10 and phone_10digit.isdigit()):
            return Response({"detail": "Invalid Indian phone number format (must be 10 digits)"}, status=400)
        phone_number = clean_phone

        if WorkerRegistration.objects.filter(phone=phone_number, is_active=True).exists():
            return Response({"detail": "ASHA worker with this phone number is already registered"}, status=400)

        if User.objects.filter(username=asha_id).exists():
            return Response({"detail": "ASHA worker with this asha_id username is already registered"}, status=400)

        # 1. Create WorkerRegistration
        reg = WorkerRegistration.objects.create(
            phone=phone_number,
            full_name=name,
            supervisor=request.user,
            village=village,
            block=block,
            district=district,
            estimated_households=estimated,
            is_active=True,
            created_by=request.user,
        )

        # 2. Create User account
        user, created = User.objects.get_or_create(
            phone=phone_number,
            defaults={
                "username": asha_id,
                "first_name": name,
                "role": User.Role.HEALTH_WORKER,
                "is_active": True,
                "region": block,
                "district": district,
                "block": block,
                "village": village,
                "estimated_households": estimated,
                "metadata": {"name_hi": name_hi},
            },
        )

        # Mock invitation SMS dispatch
        print(
            f"[SMS OUTBOX] Dispatching invite to ASHA {name} ({phone_number}): 'Saasthi app aapka intezaar kar raha hai. Download APK: https://saasthi.in/apk. Login phone: {phone_number}.'"
        )

        from services.telemetry import track_event

        track_event(
            distinct_id=str(request.user.local_uuid),
            event_name="worker_registered_manually",
            properties={
                "supervisor_role": request.user.role,
                "asha_id": asha_id,
                "village": village,
                "block": block,
                "district": district,
                "estimated_households": estimated,
            },
        )

        return Response(WorkerRegistrationSerializer(reg).data, status=status.HTTP_201_CREATED)


class BulkImportWorkersView(APIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]
    parser_classes = [MultiPartParser, JSONParser]

    def post(self, request):
        # OCR confirm array scenario
        workers_list = request.data.get("workers")
        if isinstance(workers_list, list):
            created_count = 0
            updated_count = 0
            skipped_count = 0
            errors = []
            for row in workers_list:
                try:
                    if not isinstance(row, dict):
                        skipped_count += 1
                        errors.append("Invalid row format (must be a dictionary)")
                        continue

                    phone = str(row.get("phone", "")).strip()
                    name = str(row.get("name", "")).strip()
                    asha_id = str(row.get("asha_id", "")).strip() or f"asha_{phone}"
                    village = str(row.get("village", "")).strip()

                    try:
                        estimated = int(row.get("estimated_households", 200) or 200)
                    except (TypeError, ValueError):
                        estimated = 200

                    if not phone or not name:
                        skipped_count += 1
                        errors.append(f"Missing required fields phone or name for row: {row}")
                        continue

                    from accounts.serializers import normalize_phone

                    clean_phone, phone_10digit = normalize_phone(phone)
                    if not (len(phone_10digit) == 10 and phone_10digit.isdigit()):
                        skipped_count += 1
                        errors.append(f"Invalid phone number {phone}")
                        continue
                    phone = clean_phone

                    # Check for username collision
                    if not User.objects.filter(phone=phone).exists() and User.objects.filter(username=asha_id).exists():
                        skipped_count += 1
                        errors.append(f"Username {asha_id} already exists for another user")
                        continue

                    reg, created = WorkerRegistration.objects.update_or_create(
                        phone=phone,
                        defaults={
                            "full_name": name,
                            "village": village,
                            "block": request.user.block,
                            "district": request.user.district,
                            "supervisor": request.user,
                            "estimated_households": estimated,
                            "is_active": True,
                        },
                    )

                    User.objects.update_or_create(
                        phone=phone,
                        defaults={
                            "username": asha_id,
                            "first_name": name,
                            "role": User.Role.HEALTH_WORKER,
                            "is_active": True,
                            "block": request.user.block,
                            "district": request.user.district,
                            "village": village,
                            "estimated_households": estimated,
                        },
                    )

                    if created:
                        created_count += 1
                    else:
                        updated_count += 1
                except Exception as e:
                    skipped_count += 1
                    errors.append(f"Error importing row {row}: {str(e)}")

            return Response(
                {"created": created_count, "updated": updated_count, "skipped": skipped_count, "errors": errors}
            )

        # Regular CSV file pick upload scenario
        uploaded = request.FILES.get("file")
        if not uploaded:
            return Response({"detail": "CSV file or JSON list required"}, status=400)

        from accounts.services import import_workers_csv

        results = import_workers_csv(uploaded.read(), supervisor=request.user, file_name=uploaded.name)
        return Response(results)


class WorkerDetailView(APIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]

    def get(self, request, id):
        worker = get_object_or_404(User, pk=id, role=User.Role.HEALTH_WORKER)

        # Geolocation checks
        from accounts.serializers import normalize_phone
        from django.db.models import Q

        clean_phone, phone_10digit = normalize_phone(worker.phone)
        registration = WorkerRegistration.objects.filter(
            Q(phone=clean_phone) | Q(phone=phone_10digit), is_active=True
        ).first()
        estimated = registration.estimated_households if registration else worker.estimated_households

        # Stats
        total_households = Household.objects.filter(created_by=worker).count()
        total_patients = Patient.objects.filter(asha_worker=worker).count()

        # Surveys timeline
        now = timezone.now()
        thirty_days_ago = now - timezone.timedelta(days=30)
        surveys_count = SurveyResponse.objects.filter(created_by=worker, created_at__gte=thirty_days_ago).count()

        # Recent surveys list
        recent_surveys = SurveyResponse.objects.filter(created_by=worker).order_by("-created_at")[:10]
        surveys_list = []
        for s in recent_surveys:
            surveys_list.append(
                {
                    "id": s.id,
                    "patient_name": s.patient.full_name if s.patient else "Unknown",
                    "survey_type": s.survey_type,
                    "submitted_at": s.submitted_at.isoformat(),
                    "score": s.score_snapshot.get("score", 0),
                }
            )

        # Payout approval ledger list
        incentives_qs = IncentiveLedgerEntry.objects.filter(worker=worker).order_by("-created_at")[:20]
        incentives_list = []
        for inc in incentives_qs:
            incentives_list.append(
                {
                    "id": inc.pk,
                    "activity": inc.activity_type.replace("_", " ").title(),
                    "amount": inc.amount_paise / 100,
                    "status": inc.status,
                    "created_at": inc.created_at.isoformat(),
                }
            )

        data = {
            "id": worker.pk,
            "name": worker.get_full_name() or worker.first_name,
            "asha_id": worker.username,
            "phone_number": worker.phone,
            "village": worker.village,
            "block": worker.block,
            "district": worker.district,
            "estimated_households": estimated,
            "total_households": total_households,
            "total_patients": total_patients,
            "surveys_last_30_days": surveys_count,
            "recent_surveys": surveys_list,
            "incentives": incentives_list,
        }
        return Response(data)


class UpdateWorkerView(APIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]

    def patch(self, request, id):
        from accounts.serializers import normalize_phone
        from django.db.models import Q

        worker = get_object_or_404(User, pk=id, role=User.Role.HEALTH_WORKER)

        clean_phone, phone_10digit = normalize_phone(worker.phone)
        reg = WorkerRegistration.objects.filter(Q(phone=clean_phone) | Q(phone=phone_10digit), is_active=True).first()

        name = request.data.get("name")
        phone = request.data.get("phone_number")
        village = request.data.get("village")
        estimated = request.data.get("estimated_households")

        if name:
            worker.first_name = name
            if reg:
                reg.full_name = name
        if phone:
            clean_new_phone, new_phone_10digit = normalize_phone(phone)
            if not (len(new_phone_10digit) == 10 and new_phone_10digit.isdigit()):
                return Response({"detail": "Invalid Indian phone number format (must be 10 digits)"}, status=400)
            if User.objects.filter(phone=clean_new_phone).exclude(pk=worker.pk).exists():
                return Response({"detail": "Phone number already in use by another user"}, status=400)
            if reg and WorkerRegistration.objects.filter(phone=clean_new_phone).exclude(pk=reg.pk).exists():
                return Response({"detail": "Phone number already registered to another worker"}, status=400)
            worker.phone = clean_new_phone
            if reg:
                reg.phone = clean_new_phone
        if village:
            worker.village = village
            if reg:
                reg.village = village
        if estimated is not None:
            try:
                est_val = int(estimated)
            except (TypeError, ValueError):
                return Response({"detail": "estimated_households must be an integer"}, status=400)
            worker.estimated_households = est_val
            if reg:
                reg.estimated_households = est_val

        from django.db import transaction

        with transaction.atomic():
            worker.save()
            if reg:
                reg.save()

        return Response({"status": "updated"})


class ResendSMSView(APIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]

    def post(self, request, id):
        worker = get_object_or_404(User, pk=id, role=User.Role.HEALTH_WORKER)
        # Mock SMS send
        print(
            f"[SMS OUTBOX] Dispatching invite to ASHA {worker.first_name} ({worker.phone}): 'Saasthi app aapka invite resend kiya gaya hai. Login phone: {worker.phone}.'"
        )
        return Response({"status": "sms_sent"})


class DeactivateWorkerView(APIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]

    def delete(self, request, id):
        worker = get_object_or_404(User, pk=id, role=User.Role.HEALTH_WORKER)
        worker.is_active = False
        worker.save()

        from accounts.serializers import normalize_phone
        from django.db.models import Q

        clean_phone, phone_10digit = normalize_phone(worker.phone)
        reg = WorkerRegistration.objects.filter(Q(phone=clean_phone) | Q(phone=phone_10digit), is_active=True).first()
        if reg:
            reg.is_active = False
            reg.save()

        # Revoke sessions
        AuthSession.objects.filter(worker=worker).update(revoked_at=timezone.now())

        return Response({"status": "deactivated"})


class HighRiskPatientsView(APIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]

    def get(self, request):
        patients = _patients_for_user(request.user).filter(is_high_risk_pregnancy=True)

        data = []
        for p in patients:
            data.append(
                {
                    "id": p.id,
                    "name": p.full_name,
                    "name_hi": p.name_hi,
                    "age": p.age_years,
                    "phone": p.phone,
                    "village": p.village,
                    "asha_name": p.asha_worker.get_full_name() if p.asha_worker else "Unknown",
                    "lmp": p.lmp_date.isoformat() if p.lmp_date else None,
                    "edd": p.edd.isoformat() if p.edd else None,
                }
            )

        return Response(data)


class SupervisorStatsView(APIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]

    def get(self, request):
        workers = _workers_for_user(request.user)
        patients = _patients_for_user(request.user)

        total_workers = workers.count()
        active_workers = workers.filter(is_active=True).count()

        # Joined today
        today = timezone.localdate()
        workers_joined_today = workers.filter(date_joined__date=today).count()

        total_patients = patients.count()
        high_risk_patients = patients.filter(is_high_risk_pregnancy=True).count()
        pregnancies_active = patients.filter(pregnancy_status=True).count()

        data = {
            "total_workers": total_workers,
            "active_workers": active_workers,
            "workers_joined_today": workers_joined_today,
            "total_patients": total_patients,
            "high_risk_patients": high_risk_patients,
            "pregnancies_active": pregnancies_active,
        }
        return Response(data)


class OCRExtractView(APIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]
    parser_classes = [MultiPartParser]

    def post(self, request):
        image_file = request.FILES.get("image")
        if not image_file:
            return Response({"detail": "image file required"}, status=400)

        if image_file.size > 10 * 1024 * 1024:
            return Response({"detail": "Image too large (max 10MB)"}, status=400)

        image_bytes = image_file.read()

        try:
            ocr_service = OCRService()
            extracted = ocr_service.extract_from_image(image_bytes)
        except Exception as e:
            logger.error(f"OCR extraction failed: {e}")
            return Response(
                {
                    "detail": "Could not read document. Try a clearer photo.",
                    "detail_hi": "दस्तावेज़ पढ़ नहीं सका। साफ फोटो लें।",
                },
                status=422,
            )

        return Response(
            {
                "extracted": extracted,
                "count": len(extracted),
                "message": f"Found {len(extracted)} phone numbers in the image",
            }
        )


class MonthlyReportView(APIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]

    def get(self, request):
        month = request.query_params.get("month", timezone.now().strftime("%Y-%m"))
        worker_id = request.query_params.get("worker_id")
        format_type = request.query_params.get("format", "json")

        if not worker_id:
            return Response({"detail": "worker_id is required"}, status=400)

        worker = get_object_or_404(_workers_for_user(request.user), pk=worker_id)

        if format_type == "pdf":
            service = MonthlyReportService()
            pdf_data = service.generate_worker_report(worker, month)
            response = HttpResponse(pdf_data, content_type="application/pdf")
            response["Content-Disposition"] = f'attachment; filename="ASHA_Report_{worker.username}_{month}.pdf"'
            return response

        # Default JSON response
        stats_service = MonthlyReportService()
        stats = stats_service._get_monthly_stats(worker.id, month)
        return Response(stats)


class BulkPDFReportView(APIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]

    def get(self, request):
        month = request.query_params.get("month", timezone.now().strftime("%Y-%m"))
        workers = list(_workers_for_user(request.user))

        if not workers:
            return Response({"detail": "No workers registered under this supervisor"}, status=400)

        service = MonthlyReportService()
        pdf_data = service.generate_bulk_report(workers, month)

        response = HttpResponse(pdf_data, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="Bulk_ASHA_Reports_{month}.pdf"'
        return response


class RCHShadowRegisterExportView(APIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]

    def get(self, request):
        service = NHMReportService()
        patients = _patients_for_user(request.user).filter(pregnancy_status=True).order_by("village", "full_name")
        payload = service.generate_rch_shadow_register_csv(patients)
        return _download_response(payload, "text/csv", "ANM_RCH_Shadow_Register.csv")


class FormatDExportView(APIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]

    def get(self, request):
        month = request.query_params.get("month", timezone.now().strftime("%Y-%m"))
        service = NHMReportService()
        payload = service.generate_format_d_csv(_patients_for_user(request.user), month)
        return _download_response(payload, "text/csv", f"Format_D_{month}.csv")


class HRPReferralSlipView(APIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]

    def get(self, request, patient_id):
        patient = get_object_or_404(_patients_for_user(request.user), pk=patient_id)
        service = NHMReportService()
        payload = service.generate_hrp_referral_slip_pdf(patient)
        return _download_response(payload, "application/pdf", f"HRP_Referral_{patient_id}.pdf")


class HBNCGridExportView(APIView):
    permission_classes = [IsAuthenticated, IsANMOrAdmin]

    def get(self, request, patient_id):
        patient = get_object_or_404(_patients_for_user(request.user), pk=patient_id)
        service = NHMReportService()
        payload = service.generate_hbnc_grid_csv(patient)
        return _download_response(payload, "text/csv", f"HBNC_Grid_{patient_id}.csv")


urlpatterns = [
    path("workers-overview/", WorkersOverviewView.as_view(), name="anm-workers-overview"),
    path("workers/", ManualRegisterWorkerView.as_view(), name="anm-workers-register"),
    path("workers/bulk-import/", BulkImportWorkersView.as_view(), name="anm-workers-bulk-import"),
    path("workers/<int:id>/detail/", WorkerDetailView.as_view(), name="anm-worker-detail"),
    path("workers/<int:id>/", UpdateWorkerView.as_view(), name="anm-worker-update"),
    path("workers/<int:id>/resend-sms/", ResendSMSView.as_view(), name="anm-worker-resend-sms"),
    path("workers/<int:id>/deactivate/", DeactivateWorkerView.as_view(), name="anm-worker-deactivate"),
    path("workers/ocr-extract/", OCRExtractView.as_view(), name="anm-ocr-extract"),
    path("high-risk-patients/", HighRiskPatientsView.as_view(), name="anm-high-risk-patients"),
    path("stats/", SupervisorStatsView.as_view(), name="anm-stats"),
    path("reports/monthly/", MonthlyReportView.as_view(), name="anm-reports-monthly"),
    path("reports/monthly/bulk-pdf/", BulkPDFReportView.as_view(), name="anm-reports-bulk-pdf"),
    path("reports/rch-shadow-register/", RCHShadowRegisterExportView.as_view(), name="anm-rch-shadow-register"),
    path("reports/format-d/", FormatDExportView.as_view(), name="anm-format-d"),
    path("reports/hrp-referral-slip/<int:patient_id>/", HRPReferralSlipView.as_view(), name="anm-hrp-referral-slip"),
    path("reports/hbnc-grid/<int:patient_id>/", HBNCGridExportView.as_view(), name="anm-hbnc-grid"),
]
