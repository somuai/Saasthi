import csv
import datetime
from collections import defaultdict
from io import BytesIO, StringIO

from django.utils import timezone
from mcp.models import ANCVisit, DeliveryRecord, PNCVisit
from registry.models import Patient
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


class NHMReportService:
    """Official WB/NHM-oriented report builders used by ANM and dashboard exports."""

    HBNC_DAYS = [
        ("day1", "Day 1"),
        ("day3", "Day 3"),
        ("day7", "Day 7"),
        ("day14", "Day 14"),
        ("day21", "Day 21"),
        ("day28", "Day 28"),
        ("day42", "Day 42"),
    ]

    RCH_SHADOW_HEADERS = [
        "RCH/MCTS ID",
        "Mother Name",
        "Age",
        "Village",
        "Sub-Centre Reg No",
        "ASHA Didi",
        "LMP",
        "EDD",
        "G/P/A",
        "ANC Visits",
        "TT Status",
        "Latest Hb",
        "HRP Status / Danger Signs",
    ]

    FORMAT_D_HEADERS = [
        "Village",
        "ASHA Workers",
        "Registered Pregnancies",
        "New Pregnancy Registrations",
        "High Risk Pregnancies",
        "ANC 1 Completed",
        "ANC 4 Completed",
        "Institutional Deliveries",
        "Home Deliveries",
        "PNC/HBNC Visits",
        "Neonatal Danger Signs",
    ]

    def _parse_month(self, month: str) -> tuple[int, int]:
        if not month or len(month) != 7 or month[4] != "-":
            raise ValueError("Invalid month format. Expected YYYY-MM.")
        year, month_num = month.split("-")
        return int(year), int(month_num)

    def _month_bounds(self, month: str):
        year, month_num = self._parse_month(month)
        start = timezone.datetime(year, month_num, 1, tzinfo=datetime.UTC)
        if month_num == 12:
            end = timezone.datetime(year + 1, 1, 1, tzinfo=datetime.UTC)
        else:
            end = timezone.datetime(year, month_num + 1, 1, tzinfo=datetime.UTC)
        return year, month_num, start, end

    def _csv_bytes(self, headers, rows) -> bytes:
        out = StringIO()
        writer = csv.writer(out)
        writer.writerow(headers)
        writer.writerows(rows)
        return out.getvalue().encode("utf-8-sig")

    def _latest_anc(self, patient: Patient):
        visits = list(getattr(patient, "_prefetched_objects_cache", {}).get("anc_visits", []))
        if visits:
            return sorted(visits, key=lambda visit: (visit.visit_date, visit.visit_number))[-1]
        return patient.anc_visits.order_by("-visit_date", "-visit_number").first()

    def generate_rch_shadow_register_csv(self, patients) -> bytes:
        rows = []
        for patient in patients:
            latest_anc = self._latest_anc(patient)
            anc_count = len(getattr(patient, "_prefetched_objects_cache", {}).get("anc_visits", []))
            if not anc_count:
                anc_count = patient.anc_visits.count()
            risk_flags = []
            if patient.is_high_risk_pregnancy:
                risk_flags.append("High Risk Pregnancy")
            if latest_anc and latest_anc.risk_flags_summary:
                risk_flags.extend(str(item) for item in latest_anc.risk_flags_summary)
            rows.append(
                [
                    patient.mcts_rch_id or "",
                    patient.full_name,
                    patient.age_years or "",
                    patient.village or "",
                    patient.metadata.get("sub_centre_reg_no") or patient.metadata.get("sub_centre") or "",
                    patient.asha_worker.get_full_name() if patient.asha_worker else "",
                    patient.lmp_date.isoformat() if patient.lmp_date else "",
                    patient.edd.isoformat() if patient.edd else "",
                    f"{patient.gravida or ''}/{patient.para or ''}/{patient.abortions or ''}",
                    anc_count,
                    self._tt_status(patient, latest_anc),
                    latest_anc.hemoglobin_gms if latest_anc and latest_anc.hemoglobin_gms is not None else "",
                    "; ".join(dict.fromkeys(risk_flags)) or "Normal",
                ]
            )
        return self._csv_bytes(self.RCH_SHADOW_HEADERS, rows)

    def _tt_status(self, patient: Patient, latest_anc):
        tt = patient.metadata.get("tt_status")
        if tt:
            return tt
        if latest_anc and latest_anc.tt_injection_given:
            return "Given during latest ANC"
        return ""

    def generate_format_d_csv(self, patients, month: str) -> bytes:
        year, month_num, start, end = self._month_bounds(month)
        patients = list(patients)
        patient_ids = [patient.id for patient in patients]
        village_rows = defaultdict(lambda: defaultdict(int))
        village_asha = defaultdict(set)

        for patient in patients:
            village = patient.village or "Unknown"
            if patient.asha_worker_id:
                village_asha[village].add(patient.asha_worker_id)
            if patient.pregnancy_status:
                village_rows[village]["registered_pregnancies"] += 1
            if patient.pregnancy_status and start <= patient.created_at < end:
                village_rows[village]["new_registrations"] += 1
            if patient.is_high_risk_pregnancy:
                village_rows[village]["high_risk"] += 1

        anc_visits = ANCVisit.objects.filter(
            patient_id__in=patient_ids, visit_date__year=year, visit_date__month=month_num
        )
        for row in anc_visits.values("patient__village", "visit_number"):
            village = row["patient__village"] or "Unknown"
            if row["visit_number"] == 1:
                village_rows[village]["anc1"] += 1
            if row["visit_number"] >= 4:
                village_rows[village]["anc4"] += 1

        deliveries = DeliveryRecord.objects.filter(
            mother_patient_id__in=patient_ids, delivery_date__year=year, delivery_date__month=month_num
        )
        for delivery in deliveries.select_related("mother_patient"):
            village = delivery.mother_patient.village if delivery.mother_patient else "Unknown"
            if delivery.delivery_place == DeliveryRecord.DeliveryPlace.INSTITUTION:
                village_rows[village]["institutional_deliveries"] += 1
            elif delivery.delivery_place == DeliveryRecord.DeliveryPlace.HOME:
                village_rows[village]["home_deliveries"] += 1

        pnc_visits = PNCVisit.objects.filter(
            mother_patient_id__in=patient_ids, visit_date__year=year, visit_date__month=month_num
        )
        for visit in pnc_visits.select_related("mother_patient"):
            village = visit.mother_patient.village if visit.mother_patient else "Unknown"
            village_rows[village]["pnc_visits"] += 1
            if self._has_newborn_danger_sign(visit):
                village_rows[village]["neonatal_danger_signs"] += 1

        rows = []
        for village in sorted(set(village_rows) | set(village_asha)):
            metrics = village_rows[village]
            rows.append(
                [
                    village,
                    len(village_asha[village]),
                    metrics["registered_pregnancies"],
                    metrics["new_registrations"],
                    metrics["high_risk"],
                    metrics["anc1"],
                    metrics["anc4"],
                    metrics["institutional_deliveries"],
                    metrics["home_deliveries"],
                    metrics["pnc_visits"],
                    metrics["neonatal_danger_signs"],
                ]
            )
        return self._csv_bytes(self.FORMAT_D_HEADERS, rows)

    def _has_newborn_danger_sign(self, visit: PNCVisit) -> bool:
        return any(
            [
                visit.baby_diarrhoea,
                visit.baby_vomiting,
                visit.baby_convulsions,
                visit.baby_chest_indrawing,
                visit.baby_jaundice,
                visit.baby_breathing in {"fast", "slow", "abnormal"},
                visit.baby_sucking in {"poor", "absent"},
                visit.baby_activity in {"lethargic", "inactive"},
            ]
        )

    def generate_hbnc_grid_csv(self, patient: Patient) -> bytes:
        visits_by_timing = {
            visit.visit_timing: visit
            for visit in PNCVisit.objects.filter(mother_patient=patient).order_by("visit_date", "visit_timing")
        }
        rows = []
        for key, label in self.HBNC_DAYS:
            timing_key = "24hrs" if key == "day1" else key
            visit = visits_by_timing.get(timing_key)
            rows.append(
                [
                    label,
                    visit.visit_date.isoformat() if visit else "",
                    visit.baby_weight_kg if visit and visit.baby_weight_kg is not None else "",
                    visit.baby_temp_f if visit and visit.baby_temp_f is not None else "",
                    visit.baby_sucking if visit else "",
                    visit.baby_breathing if visit else "",
                    "Yes" if visit and self._has_newborn_danger_sign(visit) else "No" if visit else "",
                    visit.asha_worker.get_full_name() if visit and visit.asha_worker else "",
                ]
            )
        return self._csv_bytes(
            [
                "HBNC Day",
                "Visit Date",
                "Baby Weight kg",
                "Baby Temp F",
                "Sucking",
                "Breathing",
                "Danger Sign",
                "ASHA Didi",
            ],
            rows,
        )

    def generate_hrp_referral_slip_pdf(self, patient: Patient) -> bytes:
        import logging
        import os
        import urllib.request

        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont

        logger = logging.getLogger(__name__)
        font_name = "Helvetica"
        try:
            font_dir = os.path.join(os.path.dirname(__file__), "fonts")
            os.makedirs(font_dir, exist_ok=True)
            font_path = os.path.join(font_dir, "NotoSansBengali-Regular.ttf")
            if not os.path.exists(font_path):
                url = "https://github.com/google/fonts/raw/main/ofl/notosansbengali/NotoSansBengali-Regular.ttf"
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
                with urllib.request.urlopen(req, timeout=15) as response, open(font_path, "wb") as f:
                    f.write(response.read())

            pdfmetrics.registerFont(TTFont("NotoSansBengali", font_path))
            font_name = "NotoSansBengali"
        except Exception as e:
            logger.exception("Failed to load/register NotoSansBengali font, falling back to Helvetica: %s", e)

        latest_anc = self._latest_anc(patient)
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=24, bottomMargin=24)
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            "NHMTitle",
            parent=styles["Heading2"],
            alignment=1,
            fontName=font_name,
            fontSize=13,
            leading=16,
            textColor=colors.HexColor("#7F1D1D"),
        )
        subtitle_style = ParagraphStyle(
            "NHMSubTitle",
            parent=styles["Heading3"],
            alignment=1,
            fontName=font_name,
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#1E3A8A"),
        )
        small_style = ParagraphStyle(
            "NHMSmall",
            parent=styles["Normal"],
            fontName=font_name,
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#475569"),
        )
        body_style = ParagraphStyle(
            "NHMBody",
            parent=styles["Normal"],
            fontName=font_name,
            fontSize=9,
            leading=12,
        )
        bold_style = ParagraphStyle(
            "NHMBold",
            parent=styles["Normal"],
            fontName=font_name,
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#0F172A"),
        )

        def p(txt, is_bold=False):
            style = bold_style if is_bold else body_style
            return Paragraph(str(txt or ""), style)

        story = [
            Paragraph(
                "Government of West Bengal / National Health Mission<br/>পশ্চিমবঙ্গ সরকার / জাতীয় স্বাস্থ্য মিশন", title_style
            ),
            Spacer(1, 4),
            Paragraph(
                "High Risk Pregnancy Referral Slip / HRP Referral<br/>উচ্চ ঝুঁকিপূর্ণ গর্ভাবস্থা রেফারেল স্লিপ / এইচআরপি রেফারেল",
                subtitle_style,
            ),
            Spacer(1, 4),
            HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E2E8F0"), spaceAfter=8),
            Paragraph(
                "Use this slip for ANM verification and PHC/FRU referral. Registered Unicode Bengali font NotoSansBengali is used for bilingual rendering.<br/>এটি এএনএম যাচাইকরণ এবং পিএইচসি/এফআরইউ রেফারেলের জন্য ব্যবহার করুন। দ্বিলিপি উপস্থাপনার জন্য নিবন্ধিত ইউনিকোড বাংলা ফন্ট NotoSansBengali ব্যবহৃত হয়েছে।",
                small_style,
            ),
            Spacer(1, 8),
        ]

        profile = [
            [
                p("RCH/MCTS ID<br/>RCH/MCTS আইডি", True),
                p(patient.mcts_rch_id),
                p("Mother Name<br/>মাতার নাম", True),
                p(patient.full_name),
            ],
            [p("Age / বয়স", True), p(patient.age_years), p("Phone / ফোন", True), p(patient.phone)],
            [
                p("Village / গ্রাম", True),
                p(patient.village),
                p("Block/District<br/>ব্লক/জেলা", True),
                p(f"{patient.block or ''} / {patient.district or ''}"),
            ],
            [
                p("LMP<br/>শেষ মাসিকের তারিখ", True),
                p(patient.lmp_date.strftime("%d-%m-%Y") if patient.lmp_date else ""),
                p("EDD<br/>সম্ভাব্য প্রসবের তারিখ", True),
                p(patient.edd.strftime("%d-%m-%Y") if patient.edd else ""),
            ],
            [
                p("G/P/A<br/>গ্র্যাভিডা/প্যারা/অ্যাবোরশন", True),
                p(f"{patient.gravida or ''}/{patient.para or ''}/{patient.abortions or ''}"),
                p("Blood Group<br/>রক্তের গ্রুপ", True),
                p(f"{patient.blood_group or ''} {patient.rh_typing or ''}"),
            ],
            [
                p("ASHA Didi<br/>আশা দিদি", True),
                p(patient.asha_worker.get_full_name() if patient.asha_worker else ""),
                p("ASHA Phone<br/>আশা ফোন", True),
                p(patient.asha_worker.phone if patient.asha_worker else ""),
            ],
        ]
        story.append(Table(profile, colWidths=[95, 145, 95, 185], style=self._grid_style(font_name=font_name)))
        story.append(Spacer(1, 10))

        risk_reasons = []
        if patient.is_high_risk_pregnancy:
            risk_reasons.append("High Risk Pregnancy / উচ্চ ঝুঁকিপূর্ণ গর্ভাবস্থা")
        if latest_anc:
            if latest_anc.bp_systolic and latest_anc.bp_systolic >= 140:
                risk_reasons.append("High BP (Systolic) / উচ্চ রক্তচাপ (সিস্টোলিক)")
            if latest_anc.bp_diastolic and latest_anc.bp_diastolic >= 90:
                risk_reasons.append("High BP (Diastolic) / উচ্চ রক্তচাপ (ডায়াস্টোলিক)")
            if latest_anc.hemoglobin_gms is not None and latest_anc.hemoglobin_gms < 11:
                risk_reasons.append(
                    f"Low Hb {latest_anc.hemoglobin_gms} g/dL / কম হিমোগ্লোবিন ({latest_anc.hemoglobin_gms} g/dL)"
                )
            for item in latest_anc.risk_flags_summary:
                risk_reasons.append(str(item))

        if not risk_reasons:
            risk_reasons.append("Review required by ANM/PHC / এএনএম/পিএইচসি দ্বারা পর্যালোচনা প্রয়োজন")

        story.append(Paragraph("<b>Danger Signs / Referral Reason (বিপদের লক্ষণ / রেফারেল কারণ)</b>", bold_style))
        story.append(Spacer(1, 4))
        story.append(
            Table(
                [[p(reason)] for reason in dict.fromkeys(risk_reasons)],
                colWidths=[520],
                style=self._grid_style(font_name=font_name),
            )
        )
        story.append(Spacer(1, 12))

        story.append(Paragraph("<b>Latest ANC Snapshot (সাম্প্রতিক এএনসি স্ন্যাপশট)</b>", bold_style))
        story.append(Spacer(1, 4))
        anc_rows = [
            [
                p("Visit Date / পরিদর্শনের তারিখ", True),
                p(latest_anc.visit_date.strftime("%d-%m-%Y") if latest_anc else ""),
            ],
            [
                p("BP / রক্তচাপ", True),
                p(f"{latest_anc.bp_systolic or ''}/{latest_anc.bp_diastolic or ''}" if latest_anc else ""),
            ],
            [
                p("Hb / হিমোগ্লোবিন", True),
                p(f"{latest_anc.hemoglobin_gms} g/dL" if latest_anc and latest_anc.hemoglobin_gms is not None else ""),
            ],
            [p("IFA Tablets / আইএফএ ট্যাবলেট", True), p(latest_anc.ifa_tablets_given if latest_anc else "")],
        ]
        story.append(Table(anc_rows, colWidths=[160, 360], style=self._grid_style(font_name=font_name)))
        story.append(Spacer(1, 24))
        story.append(
            Table(
                [
                    [
                        p("ASHA Didi signature<br/>আশা দিদির স্বাক্ষর", True),
                        p("ANM verification<br/>এএনএম যাচাইকরণ", True),
                        p("PHC/Doctor notes<br/>পিএইচসি/ডাক্তারের মন্তব্য", True),
                    ],
                    [p("\n\nDate / তারিখ:"), p("\n\nDate / তারিখ:"), p("\n\nDate / তারিখ:")],
                ],
                colWidths=[170, 170, 180],
                style=self._grid_style(font_name=font_name),
            )
        )
        doc.build(story)
        return buffer.getvalue()

    def _grid_style(self, font_name="Helvetica"):
        return TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#FEF2F2")),
                ("PADDING", (0, 0), (-1, -1), 5),
                ("FONTNAME", (0, 0), (-1, -1), font_name),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ]
        )
