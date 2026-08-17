import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class IncentiveLedgerEntry(models.Model):
    class Category(models.TextChoices):
        QUALITY = "quality", "Quality milestone"
        TRAINING = "training", "Training"
        TRANSPORT = "transport", "Transport support"
        SUPPLIES = "supplies", "Supplies"

    class ActivityType(models.TextChoices):
        SURVEY_COMPLETION = "survey_completion", "Survey completion"
        HIGH_RISK_IDENTIFICATION = "high_risk_identification", "High risk identification"
        HARD_FLAG_REFERRAL = "hard_flag_referral", "Hard flag referral"
        FOLLOWUP_COMPLETED = "followup_completed_on_time", "Follow-up completed on time"
        FOLLOWUP_MISSED = "followup_missed", "Follow-up missed"
        ANC_REGISTRATION = "anc_registration", "ANC registration"

        # ── Routine and Recurrent activities ────────────────────────────────
        VHSND_MOBILIZATION = "vhsnd_mobilization", "VHSND session mobilization"
        VHSNC_MEETING = "vhsnc_meeting", "Conveying VHSNC meeting"
        BLOCK_PHC_MEETING = "block_phc_meeting", "Attending PHC monthly meeting"
        HOUSEHOLD_LISTING = "household_listing", "Line listing of households (6-monthly)"
        VILLAGE_HEALTH_REGISTER = "village_health_register", "Maintaining Village Health Register"
        IMMUNIZATION_DUE_LIST = "immunization_due_list", "Monthly immunization due list"
        ANC_DUE_LIST = "anc_due_list", "Monthly ANC due list"
        ELIGIBLE_COUPLE_LIST = "eligible_couple_list", "Monthly eligible couple list"

        # ── Maternal Health ─────────────────────────────────────────────────
        ANC_CARE = "anc_care", "Ensuring ANC care (JSY)"
        INSTITUTIONAL_DELIVERY = "institutional_delivery", "Ensuring institutional delivery"
        REPORT_WOMAN_DEATH = "report_woman_death", "Reporting maternal death within 24h"
        HRP_MOBILIZATION = "hrp_mobilization", "Mobilizing HRP pregnant woman for follow up"
        HRP_HEALTHY_OUTCOME = "hrp_healthy_outcome", "Healthy outcome HRP (45 days post-del)"
        PNC_HRP_OUTCOME = "pnc_hrp_outcome", "Identification & healthy HRP outcome (PNC)"

        # ── Child Health & Immunization ─────────────────────────────────────
        NEWBORN_HOME_VISITS = "newborn_home_visits", "Home visits for newborn and postpartum mother"
        YOUNG_CHILD_HOME_VISITS = "young_child_home_visits", "Young child home visits (HBNC/HBYC)"
        SNCU_DISCHARGE_FOLLOWUP = "sncu_discharge_followup", "Quarterly LBW / SNCU follow-up"
        CHILD_DEATH_REPORT = "child_death_report", "Reporting child death under 5 years"
        ORS_DISTRIBUTION = "ors_distribution", "Prophylactic ORS distribution"
        FULL_IMMUNIZATION_1Y = "full_immunization_1y", "Full child immunization under 1 year"
        COMPLETE_IMMUNIZATION_2Y = "complete_immunization_2y", "Complete child immunization under 2 years"
        PULSE_POLIO_MOBILIZATION = "pulse_polio_mobilization", "Mobilizing children for Pulse Polio"
        DPT_BOOSTER = "dpt_booster", "DPT booster immunization at 5-6 years"
        ROUTINE_IMMUNIZATION_SESSION = "routine_immunization_session", "Child mobilization routine session"

        # ── Family Spacing & Planning ────────────────────────────────────────
        SPACING_2Y_MARRIAGE = "spacing_2y_marriage", "Ensuring spacing 2 years after marriage"
        SPACING_3Y_BIRTH = "spacing_3y_birth", "Ensuring spacing 3 years after 1st child"
        LIMITING_2_CHILDREN = "limiting_2_children", "Opt permanent limiting after 2 children"
        TUBECTOMY_MOTIVATION = "tubectomy_motivation", "Tubectomy motivation & follow up"
        VASECTOMY_MOTIVATION = "vasectomy_motivation", "Vasectomy / NSV motivation & follow up"
        PPIUCD_INSERTION = "ppiucd_insertion", "PPIUCD insertion facilitation"
        PAIUCD_INSERTION = "paiucd_insertion", "PAIUCD insertion facilitation"
        ANTARA_DOSE = "antara_dose", "Antara injectable contraceptive dose (1st-3rd)"
        ANTARA_4TH_DOSE = "antara_4th_dose", "Antara injectable contraceptive dose (4th)"
        MPV_CAMPAIGN_SURVEY = "mpv_campaign_survey", "MPV campaign eligible couple survey"
        SAAS_BAHU_SAMMELAN = "saas_bahu_sammelan", "Saas Bahu Sammelan mobilization"
        PPIUCD_INSERTION_MPV = "ppiucd_insertion_mpv", "PPIUCD insertion facilitation (MPV)"
        PAIUCD_INSERTION_MPV = "paiucd_insertion_mpv", "PAIUCD insertion facilitation (MPV)"

        # ── Adolescent Health ────────────────────────────────────────────────
        SANITARY_NAPKIN_DISTRIBUTION = (
            "sanitary_napkin_distribution",
            "Sanitary napkin distribution to adolescent girls",
        )
        ADOLESCENT_MEETING = "adolescent_meeting", "Monthly adolescent girls meeting (menstrual hygiene)"
        PEER_EDUCATOR_SUPPORT = "peer_educator_support", "Support to Peer Educator selection"
        ADOLESCENT_HEALTH_DAY = "adolescent_health_day", "Mobilizing for Adolescent Health Day"

        # ── Participatory Learning & Action ──────────────────────────────────
        PLA_MEETING = "pla_meeting", "PLA meeting conduct"

        # ── Nutrition ────────────────────────────────────────────────────────
        SAM_REFERRAL_FOLLOWUP = "sam_referral_followup", "SAM child referral to NRC & follow-up"
        ALBENDAZOLE_MOBILIZATION = "albendazole_mobilization", "Albendazole mobilization for eligible children"
        MAA_BREASTFEEDING_MEETING = "maa_breastfeeding_meeting", "MAA breastfeeding promotion meeting"
        IFA_COMPLIANCE_CHILDREN = "ifa_compliance_children", "IFA compliance for 6-59 months children"
        IFA_COMPLIANCE_WRA = "ifa_compliance_wra", "IFA compliance for women of reproductive age"

        # ── Abortion Care ────────────────────────────────────────────────────
        ABORTION_TRANSPORT = "abortion_transport", "Transport incentive for safe abortion services"

        # ── TB (NTEP) ────────────────────────────────────────────────────────
        TB_DS_TREATMENT_COMPLETION = "tb_ds_treatment_completion", "Drug-sensitive TB treatment completion honorarium"
        TB_DR_TREATMENT_SUPPORT = "tb_dr_treatment_support", "Drug-resistant TB treatment support"
        TB_NOTIFICATION = "tb_notification", "Presumptive TB referral & notification"
        TB_NIKSHAY_SEEDING = "tb_nikshay_seeding", "Bank account seeding on Nikshay portal"
        TB_PREVENTIVE_TREATMENT = "tb_preventive_treatment", "TB Preventive Treatment adherence support"
        TB_ADULT_BCG_MOBILIZATION = "tb_adult_bcg_mobilization", "Adult BCG mobilization"
        TB_ADULT_BCG_DUE_LIST = "tb_adult_bcg_due_list", "Adult BCG due list preparation"
        TB_BCG_SURVEY = "tb_bcg_survey", "House-to-house survey for BCG campaign"

        # ── Leprosy ──────────────────────────────────────────────────────────
        LEPROSY_PB_CASE = "leprosy_pb_case", "Paucibacillary leprosy referral & treatment compliance"
        LEPROSY_MB_CASE = "leprosy_mb_case", "Multibacillary leprosy referral & treatment compliance"
        LEPROSY_LCDC_CAMPAIGN = "leprosy_lcdc_campaign", "Leprosy Case Detection Campaign"

        # ── NVBDCP ──────────────────────────────────────────────────────────
        MALARIA_SLIDE_RDT = "malaria_slide_rdt", "Malaria blood slide / RDT preparation"
        MALARIA_TREATMENT = "malaria_treatment", "Malaria complete treatment (Pf/Pv)"
        FILARIASIS_LINELISTING = "filariasis_linelisting", "Lymphatic filariasis linelisting"
        FILARIASIS_MDA = "filariasis_mda", "Mass Drug Administration for filariasis"
        AES_JE_REFERRAL = "aes_je_referral", "AES/JE case referral to CHC/DH"
        KALA_AZAR_IRS = "kala_azar_irs", "Kala azar IRS spray round sensitization"
        KALA_AZAR_REFERRAL = "kala_azar_referral", "Kala azar suspected case referral & treatment"
        KALA_AZAR_PKDL = "kala_azar_pkdl", "Post Kala-Azar Dermal Leishmaniasis case referral"
        DENGUE_CHIKUNGUNYA_IEC = "dengue_chikungunya_iec", "Dengue/Chikungunya source reduction & IEC"
        IODINE_SALT_TESTING = "iodine_salt_testing", "Iodine salt testing"

        # ── NCD / CPHC ──────────────────────────────────────────────────────
        CBAC_FORM_FILLING = "cbac_form_filling", "CBAC form filling for NCD screening"
        NCD_FOLLOWUP = "ncd_followup", "Follow-up of HTN/Diabetes/cancer patients"
        CPHC_SERVICE_PACKAGES = "cphc_service_packages", "CPHC new service package delivery"

        # ── WASH ─────────────────────────────────────────────────────────────
        TOILET_MOTIVATION = "toilet_motivation", "Toilet construction motivation"
        TAP_CONNECTION = "tap_connection", "Individual tap connection motivation"

        # ── ASHA Certification ──────────────────────────────────────────────
        ASHA_CERTIFICATION = "asha_certification", "ASHA certification incentive (RMNCHA+N + Expanded)"

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        APPROVED = "approved", "Approved"
        PAID = "paid", "Paid"

    local_uuid = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    worker = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, related_name="incentive_entries", on_delete=models.SET_NULL
    )
    # Deprecated compat fields — kept for migration safety, use new fields below
    category = models.CharField(max_length=32, choices=Category.choices, blank=True)
    description = models.TextField(blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    # New fields
    activity_type = models.CharField(
        max_length=40, choices=ActivityType.choices, default=ActivityType.SURVEY_COMPLETION
    )
    amount_paise = models.PositiveIntegerField(default=0, help_text="Amount in paise (rupees × 100)")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    reference_id = models.UUIDField(null=True, blank=True)
    reference_type = models.CharField(max_length=50, blank=True)
    approved_by = models.CharField(max_length=100, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    month_year = models.CharField(max_length=7, blank=True, db_index=True, help_text="e.g. 2026-05")
    description_en = models.TextField(blank=True)
    description_hi = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["worker", "month_year"], name="ix_incentive_worker_month"),
            models.Index(fields=["status"], name="ix_incentive_status"),
        ]

    @property
    def amount_rupees(self):
        return self.amount_paise / 100

    def clean(self):
        if self.activity_type not in {choice[0] for choice in self.ActivityType.choices}:
            raise ValidationError(f"Invalid activity type: {self.activity_type}")

    def __str__(self):
        return f"{self.activity_type} ₹{self.amount_rupees:.2f} for {self.worker_id}"


class IncentiveRate(models.Model):
    activity_type = models.CharField(max_length=40, choices=IncentiveLedgerEntry.ActivityType.choices, unique=True)
    amount_paise = models.PositiveIntegerField(help_text="Amount in paise (rupees × 100)")
    label_en = models.CharField(max_length=120, blank=True)
    label_hi = models.CharField(max_length=120, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["activity_type"]
        verbose_name = "Incentive Rate"
        verbose_name_plural = "Incentive Rates"

    @property
    def amount_rupees(self):
        return self.amount_paise / 100

    def __str__(self):
        return f"{self.get_activity_type_display()}: ₹{self.amount_rupees:.2f}"


class ASHAWorkerProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="asha_profile")
    asha_id = models.CharField(max_length=20, unique=True, db_index=True)
    husband_name = models.CharField(max_length=255, blank=True, default="")
    bank_details = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "ASHA Worker Profile"
        verbose_name_plural = "ASHA Worker Profiles"
        ordering = ["asha_id"]

    def __str__(self):
        name = self.user.get_full_name() or self.user.phone or "—"
        return f"{name} ({self.asha_id})"
