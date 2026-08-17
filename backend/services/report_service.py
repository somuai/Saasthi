import calendar
import datetime
from io import BytesIO

from accounts.models import User, WorkerRegistration
from django.db.models import Sum
from django.utils import timezone
from followups.models import FollowUp
from incentives.models import IncentiveLedgerEntry
from mcp.models import ANCVisit, DeliveryRecord, GrowthRecord, ImmunizationRecord
from registry.models import Household, Patient
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table
from surveys.models import SurveyResponse


class MonthlyReportService:
    def _parse_month(self, month: str) -> tuple[int, int]:
        import re

        if not month or not re.match(r"^\d{4}-\d{2}$", month):
            raise ValueError(f"Invalid month format: {month}. Expected YYYY-MM.")
        return tuple(map(int, month.split("-")))

    def _get_monthly_stats(self, worker_id: int, month: str) -> dict:
        """
        Gathers performance and incentive metrics for a worker in a given month.
        month: e.g. "2026-05"
        """
        year, month_num = self._parse_month(month)

        # Dates scopes
        start_date = timezone.datetime(year, month_num, 1, tzinfo=datetime.UTC)
        if month_num == 12:
            end_date = timezone.datetime(year + 1, 1, 1, tzinfo=datetime.UTC)
        else:
            end_date = timezone.datetime(year, month_num + 1, 1, tzinfo=datetime.UTC)

        # Worker object
        worker = User.objects.filter(pk=worker_id).first()
        if not worker:
            raise ValueError(f"Worker with ID {worker_id} not found")
        registration = WorkerRegistration.objects.filter(phone=worker.phone, is_active=True).first()
        estimated = registration.estimated_households if registration else worker.estimated_households

        # Incentives stats
        incentives_qs = IncentiveLedgerEntry.objects.filter(
            worker_id=worker_id, created_at__gte=start_date, created_at__lt=end_date
        )
        total_earned = incentives_qs.aggregate(total=Sum("amount_paise"))["total"] or 0
        total_earned = total_earned // 100

        # JJSY / Institutional Deliveries
        inst_deliveries = DeliveryRecord.objects.filter(
            asha_worker_id=worker_id,
            delivery_date__year=year,
            delivery_date__month=month_num,
            delivery_place=DeliveryRecord.DeliveryPlace.INSTITUTION,
        ).count()

        # Monthly Activity Stats
        h_month = Household.objects.filter(
            created_by_id=worker_id, created_at__gte=start_date, created_at__lt=end_date
        ).count()
        h_total = Household.objects.filter(created_by_id=worker_id).count()

        s_month = SurveyResponse.objects.filter(
            created_by_id=worker_id, created_at__gte=start_date, created_at__lt=end_date
        ).count()
        s_total = SurveyResponse.objects.filter(created_by_id=worker_id).count()

        hr_month = Patient.objects.filter(
            asha_worker_id=worker_id, is_high_risk_pregnancy=True, created_at__gte=start_date, created_at__lt=end_date
        ).count()
        hr_total = Patient.objects.filter(asha_worker_id=worker_id, is_high_risk_pregnancy=True).count()

        f_month = FollowUp.objects.filter(
            worker_id=worker_id,
            status=FollowUp.Status.COMPLETED,
            completed_at__gte=start_date,
            completed_at__lt=end_date,
        ).count()
        f_total = FollowUp.objects.filter(worker_id=worker_id, status=FollowUp.Status.COMPLETED).count()

        anc_month = ANCVisit.objects.filter(
            asha_worker_id=worker_id, visit_date__year=year, visit_date__month=month_num
        ).count()
        anc_total = ANCVisit.objects.filter(asha_worker_id=worker_id).count()

        del_month = DeliveryRecord.objects.filter(
            asha_worker_id=worker_id, delivery_date__year=year, delivery_date__month=month_num
        ).count()
        del_total = DeliveryRecord.objects.filter(asha_worker_id=worker_id).count()

        grow_month = GrowthRecord.objects.filter(
            asha_worker_id=worker_id, recorded_date__year=year, recorded_date__month=month_num
        ).count()
        grow_total = GrowthRecord.objects.filter(asha_worker_id=worker_id).count()

        vac_month = ImmunizationRecord.objects.filter(
            asha_worker_id=worker_id, status="given", administered_date__year=year, administered_date__month=month_num
        ).count()
        vac_total = ImmunizationRecord.objects.filter(asha_worker_id=worker_id, status="given").count()

        return {
            "estimated_households": estimated,
            "households_this_month": h_month,
            "total_households": h_total,
            "surveys_this_month": s_month,
            "total_surveys": s_total,
            "high_risk_this_month": hr_month,
            "total_high_risk": hr_total,
            "followups_this_month": f_month,
            "total_followups": f_total,
            "anc_this_month": anc_month,
            "total_anc": anc_total,
            "deliveries_this_month": del_month,
            "total_deliveries": del_total,
            "growth_this_month": grow_month,
            "total_growth": grow_total,
            "vaccines_this_month": vac_month,
            "total_vaccines": vac_total,
            "institutional_deliveries": inst_deliveries,
            "total_incentive_earned": total_earned,
        }

    def generate_worker_report(self, worker: User, month: str) -> bytes:
        """Generate single-page monthly performance report PDF for one worker."""
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20, bottomMargin=20)
        styles = getSampleStyleSheet()
        story = []

        year, month_num = self._parse_month(month)
        month_name = calendar.month_name[month_num]

        # Header Styles
        h_style = ParagraphStyle(
            "GOIHeader",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=14,
            alignment=1,  # Center
            textColor=colors.HexColor("#0D1B2A"),
        )
        sub_style = ParagraphStyle(
            "SubHeader",
            parent=styles["Normal"],
            fontSize=10,
            leading=12,
            alignment=1,
            textColor=colors.HexColor("#6B7280"),
        )
        normal_b = ParagraphStyle("NormalBold", parent=styles["Normal"], fontName="Helvetica-Bold")

        story.append(Paragraph("<b>GOVERNMENT OF INDIA</b> — Ministry of Health & Family Welfare", h_style))
        story.append(Paragraph("National Health Mission — ASHA Monthly Performance Report", sub_style))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceAfter=8))
        story.append(Spacer(1, 4))

        # Worker Profile Table
        profile_data = [
            [
                Paragraph(
                    f"<b>ASHA Worker:</b> {worker.get_full_name() or worker.first_name or worker.phone}",
                    styles["Normal"],
                ),
                Paragraph(f"<b>ASHA ID:</b> {worker.username}", styles["Normal"]),
            ],
            [
                Paragraph(f"<b>Village:</b> {worker.village or '—'} · {worker.block or '—'}", styles["Normal"]),
                Paragraph(f"<b>Reporting Month:</b> {month_name} {year}", styles["Normal"]),
            ],
        ]
        t_profile = Table(profile_data, colWidths=[240, 240])
        t_profile.setStyle(
            [
                ("PADDING", (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
        story.append(t_profile)
        story.append(Spacer(1, 10))

        # Stats Calculations
        stats = self._get_monthly_stats(worker.pk, month)

        # Performance table
        story.append(Paragraph("<b>1. Performance Metrics</b>", normal_b))
        story.append(Spacer(1, 4))
        activity_data = [
            [
                Paragraph("<b>Activity Description</b>", normal_b),
                Paragraph("<b>This Month</b>", normal_b),
                Paragraph("<b>Total Cumulative</b>", normal_b),
            ],
            [
                "Households Registered",
                str(stats["households_this_month"]),
                f"{stats['total_households']} (est. {stats['estimated_households']})",
            ],
            ["Health Surveys Completed", str(stats["surveys_this_month"]), str(stats["total_surveys"])],
            ["High-Risk Pregnancies Logged", str(stats["high_risk_this_month"]), str(stats["total_high_risk"])],
            ["Follow-up Visits Completed", str(stats["followups_this_month"]), str(stats["total_followups"])],
            ["ANC Mobilizations / Visits", str(stats["anc_this_month"]), str(stats["total_anc"])],
            ["Deliveries Registered", str(stats["deliveries_this_month"]), str(stats["total_deliveries"])],
            ["Children Growth Records (WHO)", str(stats["growth_this_month"]), str(stats["total_growth"])],
            ["Routine Vaccines Administered", str(stats["vaccines_this_month"]), str(stats["total_vaccines"])],
        ]
        t_activity = Table(activity_data, colWidths=[240, 100, 140])
        t_activity.setStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F8FAFC")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("PADDING", (0, 0), (-1, -1), 5),
                ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
        story.append(t_activity)
        story.append(Spacer(1, 12))

        # Incentives table
        story.append(Paragraph("<b>2. Incentives & Payout Breakdown</b>", normal_b))
        story.append(Spacer(1, 4))

        # Calculate individual payouts based on rates
        survey_payout = stats["surveys_this_month"] * 50
        hr_payout = stats["high_risk_this_month"] * 150
        del_payout = stats["institutional_deliveries"] * 600
        other_payout = max(0, stats["total_incentive_earned"] - (survey_payout + hr_payout + del_payout))

        incentive_data = [
            [
                Paragraph("<b>Incentive Description</b>", normal_b),
                Paragraph("<b>Volume</b>", normal_b),
                Paragraph("<b>Rate</b>", normal_b),
                Paragraph("<b>Amount</b>", normal_b),
            ],
            ["Survey Completions", str(stats["surveys_this_month"]), "Rs 50", f"Rs {survey_payout}"],
            ["High-Risk Care Mobilization", str(stats["high_risk_this_month"]), "Rs 150", f"Rs {hr_payout}"],
            ["Institutional Delivery JSY", str(stats["institutional_deliveries"]), "Rs 600", f"Rs {del_payout}"],
            ["Routine Program VHSND/Other", "—", "—", f"Rs {other_payout}"],
            [
                "",
                "",
                Paragraph("<b>Total Approved Payout</b>", normal_b),
                Paragraph(f"<b>Rs {stats['total_incentive_earned']}</b>", normal_b),
            ],
        ]
        t_incentive = Table(incentive_data, colWidths=[200, 80, 80, 120])
        t_incentive.setStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F8FAFC")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                ("PADDING", (0, 0), (-1, -1), 5),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("LINEBELOW", (0, -1), (-1, -1), 1.5, colors.HexColor("#0D1B2A")),
            ]
        )
        story.append(t_incentive)
        story.append(Spacer(1, 24))

        # Signatures
        sig_data = [
            [
                Paragraph("<b>ASHA Worker Signature:</b>", styles["Normal"]),
                Paragraph("<b>ANM Supervisor Signature:</b>", styles["Normal"]),
            ],
            [
                Paragraph("_____________________________<br/>Date: ____/____/________", styles["Normal"]),
                Paragraph("_____________________________<br/>Date: ____/____/________", styles["Normal"]),
            ],
        ]
        t_sig = Table(sig_data, colWidths=[240, 240])
        t_sig.setStyle(
            [
                ("PADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 1), (-1, 1), 16),
            ]
        )
        story.append(t_sig)
        story.append(Spacer(1, 14))

        # Footer
        footer_style = ParagraphStyle(
            "ReportFooter",
            parent=styles["Normal"],
            fontName="Helvetica-Oblique",
            fontSize=8,
            textColor=colors.HexColor("#94A3B8"),
            alignment=1,
        )
        story.append(
            Paragraph(
                "System-generated report. Valid with official signature and stamp only. &copy; National Health Mission - Saasthi",
                footer_style,
            )
        )

        doc.build(story)
        return buffer.getvalue()

    def generate_bulk_report(self, workers: list[User], month: str) -> bytes:
        """Generate a multi-page PDF report containing pages for all specified ASHA workers."""
        from reportlab.platypus import PageBreak

        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20, bottomMargin=20)
        styles = getSampleStyleSheet()
        story = []

        year, month_num = self._parse_month(month)
        month_name = calendar.month_name[month_num]

        h_style = ParagraphStyle(
            "GOIHeader",
            parent=styles["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=14,
            alignment=1,
            textColor=colors.HexColor("#0D1B2A"),
        )
        sub_style = ParagraphStyle(
            "SubHeader",
            parent=styles["Normal"],
            fontSize=10,
            leading=12,
            alignment=1,
            textColor=colors.HexColor("#6B7280"),
        )
        normal_b = ParagraphStyle("NormalBold", parent=styles["Normal"], fontName="Helvetica-Bold")
        footer_style = ParagraphStyle(
            "ReportFooter",
            parent=styles["Normal"],
            fontName="Helvetica-Oblique",
            fontSize=8,
            textColor=colors.HexColor("#94A3B8"),
            alignment=1,
        )

        for idx, worker in enumerate(workers):
            story.append(Paragraph("<b>GOVERNMENT OF INDIA</b> — Ministry of Health & Family Welfare", h_style))
            story.append(Paragraph("National Health Mission — ASHA Monthly Performance Report", sub_style))
            story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceAfter=8))
            story.append(Spacer(1, 4))

            profile_data = [
                [
                    Paragraph(
                        f"<b>ASHA Worker:</b> {worker.get_full_name() or worker.first_name or worker.phone}",
                        styles["Normal"],
                    ),
                    Paragraph(f"<b>ASHA ID:</b> {worker.username}", styles["Normal"]),
                ],
                [
                    Paragraph(f"<b>Village:</b> {worker.village or '—'} · {worker.block or '—'}", styles["Normal"]),
                    Paragraph(f"<b>Reporting Month:</b> {month_name} {year}", styles["Normal"]),
                ],
            ]
            t_profile = Table(profile_data, colWidths=[240, 240])
            t_profile.setStyle(
                [
                    ("PADDING", (0, 0), (-1, -1), 2),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
            story.append(t_profile)
            story.append(Spacer(1, 10))

            stats = self._get_monthly_stats(worker.pk, month)

            story.append(Paragraph("<b>1. Performance Metrics</b>", normal_b))
            story.append(Spacer(1, 4))
            activity_data = [
                [
                    Paragraph("<b>Activity Description</b>", normal_b),
                    Paragraph("<b>This Month</b>", normal_b),
                    Paragraph("<b>Total Cumulative</b>", normal_b),
                ],
                [
                    "Households Registered",
                    str(stats["households_this_month"]),
                    f"{stats['total_households']} (est. {stats['estimated_households']})",
                ],
                ["Health Surveys Completed", str(stats["surveys_this_month"]), str(stats["total_surveys"])],
                ["High-Risk Pregnancies Logged", str(stats["high_risk_this_month"]), str(stats["total_high_risk"])],
                ["Follow-up Visits Completed", str(stats["followups_this_month"]), str(stats["total_followups"])],
                ["ANC Mobilizations / Visits", str(stats["anc_this_month"]), str(stats["total_anc"])],
                ["Deliveries Registered", str(stats["deliveries_this_month"]), str(stats["total_deliveries"])],
                ["Children Growth Records (WHO)", str(stats["growth_this_month"]), str(stats["total_growth"])],
                ["Routine Vaccines Administered", str(stats["vaccines_this_month"]), str(stats["total_vaccines"])],
            ]
            t_activity = Table(activity_data, colWidths=[240, 100, 140])
            t_activity.setStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F8FAFC")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                    ("PADDING", (0, 0), (-1, -1), 5),
                    ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ]
            )
            story.append(t_activity)
            story.append(Spacer(1, 12))

            story.append(Paragraph("<b>2. Incentives & Payout Breakdown</b>", normal_b))
            story.append(Spacer(1, 4))

            survey_payout = stats["surveys_this_month"] * 50
            hr_payout = stats["high_risk_this_month"] * 150
            del_payout = stats["institutional_deliveries"] * 600
            other_payout = max(0, stats["total_incentive_earned"] - (survey_payout + hr_payout + del_payout))

            incentive_data = [
                [
                    Paragraph("<b>Incentive Description</b>", normal_b),
                    Paragraph("<b>Volume</b>", normal_b),
                    Paragraph("<b>Rate</b>", normal_b),
                    Paragraph("<b>Amount</b>", normal_b),
                ],
                ["Survey Completions", str(stats["surveys_this_month"]), "Rs 50", f"Rs {survey_payout}"],
                ["High-Risk Care Mobilization", str(stats["high_risk_this_month"]), "Rs 150", f"Rs {hr_payout}"],
                ["Institutional Delivery JSY", str(stats["institutional_deliveries"]), "Rs 600", f"Rs {del_payout}"],
                ["Routine Program VHSND/Other", "—", "—", f"Rs {other_payout}"],
                [
                    "",
                    "",
                    Paragraph("<b>Total Approved Payout</b>", normal_b),
                    Paragraph(f"<b>Rs {stats['total_incentive_earned']}</b>", normal_b),
                ],
            ]
            t_incentive = Table(incentive_data, colWidths=[200, 80, 80, 120])
            t_incentive.setStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F8FAFC")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
                    ("PADDING", (0, 0), (-1, -1), 5),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("LINEBELOW", (0, -1), (-1, -1), 1.5, colors.HexColor("#0D1B2A")),
                ]
            )
            story.append(t_incentive)
            story.append(Spacer(1, 20))

            sig_data = [
                [
                    Paragraph("<b>ASHA Worker Signature:</b>", styles["Normal"]),
                    Paragraph("<b>ANM Supervisor Signature:</b>", styles["Normal"]),
                ],
                [
                    Paragraph("_____________________________<br/>Date: ____/____/________", styles["Normal"]),
                    Paragraph("_____________________________<br/>Date: ____/____/________", styles["Normal"]),
                ],
            ]
            t_sig = Table(sig_data, colWidths=[240, 240])
            t_sig.setStyle(
                [
                    ("PADDING", (0, 0), (-1, -1), 0),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 1), (-1, 1), 12),
                ]
            )
            story.append(t_sig)
            story.append(Spacer(1, 10))

            story.append(
                Paragraph(
                    "System-generated report. Valid with official signature and stamp only. &copy; National Health Mission - Saasthi",
                    footer_style,
                )
            )

            if idx < len(workers) - 1:
                story.append(PageBreak())

        doc.build(story)
        return buffer.getvalue()
