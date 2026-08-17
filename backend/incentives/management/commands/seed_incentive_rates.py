from django.core.management.base import BaseCommand

from incentives.models import IncentiveRate

DEFAULT_RATES = [
    # ── Legacy / Basic Core Activities ──────────────────────────────────────────
    ("survey_completion", 5000, "Survey completion", "सर्वेक्षण पूर्णता"),
    ("high_risk_identification", 15000, "High risk identification", "उच्च जोखिम पहचान"),
    ("hard_flag_referral", 20000, "Hard flag referral", "हार्ड फ्लैग रेफरल"),
    ("followup_completed_on_time", 7500, "Follow-up completed on time", "समय पर अनुवर्तन पूर्णता"),
    ("followup_missed", 0, "Follow-up missed", "अनुवर्तन छूट गया"),
    ("anc_registration", 30000, "ANC registration", "एएनसी पंजीकरण"),
    # ── Routine and Recurrent activities ───────────────────────────────────
    ("vhsnd_mobilization", 20000, "VHSND session mobilization", "ग्राम स्वास्थ्य स्वच्छता और पोषण दिवस सत्र संघटन"),
    ("vhsnc_meeting", 15000, "Conveying VHSNC meeting", "वीएचएसएनसी बैठक आयोजित करना"),
    ("block_phc_meeting", 15000, "Attending PHC monthly meeting", "ब्लॉक पीएचसी मासिक बैठक में भाग लेना"),
    ("household_listing", 30000, "Line listing of households (6-monthly)", "घरों की सूची तैयार करना (छह-मासिक)"),
    ("village_health_register", 30000, "Maintaining Village Health Register", "ग्राम स्वास्थ्य रजिस्टर का रखरखाव"),
    ("immunization_due_list", 30000, "Monthly immunization due list", "मासिक टीकाकरण देय सूची"),
    ("anc_due_list", 30000, "Monthly ANC due list", "मासिक एएनसी देय सूची"),
    ("eligible_couple_list", 30000, "Monthly eligible couple list", "मासिक योग्य दंपत्ति सूची"),
    # ── Maternal Health ──────────────────────────────────────────────────────────
    ("anc_care", 30000, "Ensuring ANC care (JSY)", "एंटीनेटल देखभाल सुनिश्चित करना (जेएसवाई)"),
    ("institutional_delivery", 30000, "Ensuring institutional delivery", "संस्थागत प्रसव सुनिश्चित करना"),
    ("report_woman_death", 20000, "Reporting maternal death within 24h", "24 घंटे के भीतर मातृ मृत्यु की रिपोर्ट करना"),
    ("hrp_mobilization", 10000, "Mobilizing HRP pregnant woman for follow up", "उच्च जोखिम गर्भावस्था अनुवर्तन संघटन"),
    ("hrp_healthy_outcome", 50000, "Healthy outcome HRP (45 days post-del)", "उच्च जोखिम गर्भावस्था स्वस्थ परिणाम (45 दिन)"),
    ("pnc_hrp_outcome", 25000, "Identification & healthy HRP outcome (PNC)", "प्रसवोत्तर उच्च जोखिम गर्भावस्था स्वस्थ परिणाम"),
    # ── Child Health & Immunization ─────────────────────────────────────────────
    (
        "newborn_home_visits",
        25000,
        "Home visits for newborn and postpartum mother",
        "नवजात शिशु और प्रसवोत्तर मां के लिए गृह भेंट",
    ),
    ("young_child_home_visits", 25000, "Young child home visits (HBNC/HBYC)", "छोटे बच्चों के लिए गृह भेंट"),
    ("sncu_discharge_followup", 5000, "Quarterly LBW / SNCU follow-up", "कम वजन वाले नवजात अनुवर्तन (त्रैमासिक)"),
    ("child_death_report", 5000, "Reporting child death under 5 years", "5 वर्ष से कम उम्र के बच्चे की मृत्यु की रिपोर्ट"),
    ("ors_distribution", 10000, "Prophylactic ORS distribution", "रोगनिरोधी ओआरएस वितरण"),
    ("full_immunization_1y", 10000, "Full child immunization under 1 year", "1 वर्ष से कम उम्र के बच्चे का पूर्ण टीकाकरण"),
    (
        "complete_immunization_2y",
        7500,
        "Complete child immunization under 2 years",
        "2 वर्ष से कम उम्र के बच्चे का पूर्ण टीकाकरण",
    ),
    ("pulse_polio_mobilization", 10000, "Mobilizing children for Pulse Polio", "पल्स पोलियो टीकाकरण संघटन"),
    ("dpt_booster", 5000, "DPT booster immunization at 5-6 years", "5-6 वर्ष की आयु में डीपीटी बूस्टर"),
    ("routine_immunization_session", 15000, "Child mobilization routine session", "नियमित टीकाकरण सत्र संघटन"),
    # ── Family Spacing & Planning ────────────────────────────────────────────────
    ("spacing_2y_marriage", 50000, "Ensuring spacing 2 years after marriage", "शादी के 2 साल बाद अंतर सुनिश्चित करना"),
    ("spacing_3y_birth", 50000, "Ensuring spacing 3 years after 1st child", "पहले बच्चे के बाद 3 साल का अंतर सुनिश्चित करना"),
    ("limiting_2_children", 100000, "Opt permanent limiting after 2 children", "2 बच्चों के बाद स्थायी नियोजन विकल्प"),
    ("tubectomy_motivation", 30000, "Tubectomy motivation & follow up", "नसबंदी (महिला) प्रेरणा और अनुवर्तन"),
    ("vasectomy_motivation", 40000, "Vasectomy / NSV motivation & follow up", "पुरुष नसबंदी प्रेरणा और अनुवर्तन"),
    ("ppiucd_insertion", 15000, "PPIUCD insertion facilitation", "पीपीआईयूसीडी प्रविष्टि सुविधा"),
    ("paiucd_insertion", 15000, "PAIUCD insertion facilitation", "पीएआईयूसीडी प्रविष्टि सुविधा"),
    ("antara_dose", 10000, "Antara injectable contraceptive dose (1st-3rd)", "अंतरा इंजेक्शन गर्भनिरोधक खुराक (पहली-तीसरी)"),
    ("antara_4th_dose", 20000, "Antara injectable contraceptive dose (4th)", "अंतरा इंजेक्शन गर्भनिरोधक खुराक (चौथी)"),
    ("mpv_campaign_survey", 15000, "MPV campaign eligible couple survey", "एमपीवी अभियान योग्य दंपत्ति सर्वेक्षण"),
    ("saas_bahu_sammelan", 20000, "Saas Bahu Sammelan mobilization", "सास बहु सम्मेलन आयोजन"),
    ("ppiucd_insertion_mpv", 30000, "PPIUCD insertion facilitation (MPV)", "पीपीआईयूसीडी प्रविष्टि सुविधा (एमपीवी)"),
    ("paiucd_insertion_mpv", 30000, "PAIUCD insertion facilitation (MPV)", "पीएआईयूसीडी प्रविष्टि सुविधा (एमपीवी)"),
    # ── Adolescent Health ────────────────────────────────────────────────────────
    ("sanitary_napkin_distribution", 100, "Sanitary napkin distribution per pack", "सैनिटरी नैपकिन वितरण प्रति पैक"),
    ("adolescent_meeting", 5000, "Monthly adolescent girls meeting", "किशोरी बालिका मासिक बैठक"),
    ("peer_educator_support", 10000, "Peer Educator support incentive", "पीयर एजुकेटर सहायता प्रोत्साहन"),
    ("adolescent_health_day", 20000, "Adolescent Health Day mobilization", "किशोर स्वास्थ्य दिवस संघटन"),
    # ── Participatory Learning & Action ─────────────────────────────────────────
    ("pla_meeting", 10000, "PLA meeting conduct", "पीएलए बैठक आयोजन"),
    # ── Nutrition ───────────────────────────────────────────────────────────────
    (
        "sam_referral_followup",
        30000,
        "SAM child referral to NRC & follow-up",
        "गंभीर कुपोषित बच्चे का एनआरसी रेफरल और अनुवर्तन",
    ),
    ("albendazole_mobilization", 10000, "Albendazole mobilization (bi-annual)", "एल्बेंडाजोल संघटन (द्वि-वार्षिक)"),
    ("maa_breastfeeding_meeting", 10000, "MAA breastfeeding promotion meeting", "एमएए स्तनपान प्रोत्साहन बैठक"),
    ("ifa_compliance_children", 10000, "IFA compliance for 6-59 months children", "6-59 माह के बच्चों के लिए आईएफए अनुपालन"),
    (
        "ifa_compliance_wra",
        5000,
        "IFA compliance for women of reproductive age",
        "प्रजनन आयु वर्ग की महिलाओं के लिए आईएफए अनुपालन",
    ),
    # ── Abortion Care ───────────────────────────────────────────────────────────
    ("abortion_transport", 20000, "Transport incentive for safe abortion", "सुरक्षित गर्भपात के लिए परिवहन प्रोत्साहन"),
    # ── TB (NTEP) ───────────────────────────────────────────────────────────────
    ("tb_ds_treatment_completion", 100000, "DS-TB treatment completion honorarium", "डीएस-टीबी उपचार पूर्णता मानदेय"),
    ("tb_dr_treatment_support", 500000, "Drug-resistant TB treatment support", "दवा-प्रतिरोधी टीबी उपचार सहायता"),
    ("tb_notification", 50000, "Presumptive TB referral & notification", "संदिग्ध टीबी रेफरल और अधिसूचना"),
    ("tb_nikshay_seeding", 5000, "Bank account seeding on Nikshay portal", "निक्षय पोर्टल पर बैंक खाता सीडिंग"),
    ("tb_preventive_treatment", 25000, "TB Preventive Treatment adherence support", "टीबी निवारक उपचार अनुपालन सहायता"),
    ("tb_adult_bcg_mobilization", 7500, "Adult BCG mobilization per session", "वयस्क बीसीजी संघटन प्रति सत्र"),
    ("tb_adult_bcg_due_list", 30000, "Adult BCG due list preparation", "वयस्क बीसीजी देय सूची तैयार करना"),
    ("tb_bcg_survey", 30000, "House-to-house BCG campaign survey", "बीसीजी अभियान घर-घर सर्वेक्षण"),
    # ── Leprosy ─────────────────────────────────────────────────────────────────
    ("leprosy_pb_case", 40000, "Paucibacillary leprosy treatment compliance", "अल्प-बैसिलरी कुष्ठ उपचार अनुपालन"),
    ("leprosy_mb_case", 60000, "Multibacillary leprosy treatment compliance", "बहु-बैसिलरी कुष्ठ उपचार अनुपालन"),
    ("leprosy_lcdc_campaign", 105000, "LCDC campaign (14 days)", "कुष्ठ रोग जांच अभियान (14 दिन)"),
    # ── NVBDCP ──────────────────────────────────────────────────────────────────
    ("malaria_slide_rdt", 1500, "Malaria blood slide / RDT", "मलेरिया ब्लड स्लाइड / आरडीटी"),
    ("malaria_treatment", 20000, "Malaria complete treatment", "मलेरिया पूर्ण उपचार"),
    ("filariasis_linelisting", 20000, "Filariasis linelisting", "फाइलेरिया लाइनलिस्टिंग"),
    ("filariasis_mda", 300000, "MDA for filariasis (15 days)", "फाइलेरिया के लिए सामूहिक दवा वितरण (15 दिन)"),
    ("aes_je_referral", 30000, "AES/JE case referral", "एईएस/जेई मामले का रेफरल"),
    ("kala_azar_irs", 10000, "Kala azar IRS spray round", "कालाजार आईआरएस छिड़काव दौर"),
    ("kala_azar_referral", 50000, "Kala azar case referral & treatment", "कालाजार मामला रेफरल और उपचार"),
    ("kala_azar_pkdl", 50000, "PKDL case referral", "पीकेडीएल मामला रेफरल"),
    ("dengue_chikungunya_iec", 20000, "Dengue/Chikungunya source reduction & IEC", "डेंगू/चिकनगुनिया स्रोत कटौती और आईईसी"),
    ("iodine_salt_testing", 2500, "Iodine salt testing", "आयोडीन नमक परीक्षण"),
    # ── NCD / CPHC ──────────────────────────────────────────────────────────────
    ("cbac_form_filling", 1000, "CBAC form filling per individual", "सीबीएसी फॉर्म भरना प्रति व्यक्ति"),
    ("ncd_followup", 5000, "NCD patient follow-up (bi-annual)", "एनसीडी रोगी अनुवर्तन (द्वि-वार्षिक)"),
    ("cphc_service_packages", 100000, "CPHC new service package delivery", "सीपीएचसी नई सेवा पैकेज वितरण"),
    # ── WASH ────────────────────────────────────────────────────────────────────
    ("toilet_motivation", 7500, "Toilet construction motivation per HH", "शौचालय निर्माण प्रेरणा प्रति परिवार"),
    ("tap_connection", 7500, "Tap connection motivation per HH", "नल कनेक्शन प्रेरणा प्रति परिवार"),
    # ── ASHA Certification ──────────────────────────────────────────────────────
    (
        "asha_certification",
        1000000,
        "ASHA certification incentive (2 certificates)",
        "आशा प्रमाणन प्रोत्साहन (2 प्रमाणपत्र)",
    ),
]


class Command(BaseCommand):
    help = "Seeds all ASHA Routine and National Health Program incentive rates into the IncentiveRate table."

    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0
        self.stdout.write("Seeding ASHA Routine and National Program Incentive Rates...")

        for activity_type, amount_paise, label_en, label_hi in DEFAULT_RATES:
            obj, created = IncentiveRate.objects.update_or_create(
                activity_type=activity_type,
                defaults={
                    "amount_paise": amount_paise,
                    "label_en": label_en,
                    "label_hi": label_hi,
                    "is_active": True,
                },
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        self.stdout.write(self.style.SUCCESS(f"Seeding completed: {created_count} created, {updated_count} updated."))
