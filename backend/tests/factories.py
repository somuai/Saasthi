from datetime import date, timedelta

import factory
from accounts.models import User
from django.utils import timezone
from flagging.models import Flag
from followups.models import FollowUp
from incentives.models import IncentiveLedgerEntry
from mcp.models import (
    ANCVisit,
    CareInteraction,
    DevelopmentMilestoneCheck,
    GrowthRecord,
    ImmunizationRecord,
    PNCVisit,
)
from referrals.models import Referral
from registry.models import Household, Patient
from risk_engine.models import RiskRule
from surveys.models import SurveyResponse

INDIAN_VILLAGES = [
    "Bagbera", "Rampur", "Sitapur", "Jagdishpur", "Maholi",
    "Khanpur", "Tikaitnagar", "Firozabad", "Biswan", "Laharpur",
]
INDIAN_BLOCKS = [
    "Barhampur", "Misrikh", "Mahmoodabad", "Biswan", "Laharpur",
    "Siddhaur", "Hargaon", "Reusa", "Pariyar", "Gondlamau",
]
INDIAN_DISTRICTS = [
    "Sitapur", "Barabanki", "Lucknow", "Unnao", "Hardoi",
    "Lakhimpur Kheri", "Rae Bareli", "Faizabad", "Sultanpur", "Bahraich",
]
INDIAN_FIRST_NAMES = [
    "Sunita", "Priya", "Anita", "Rekha", "Kavita", "Sarita", "Geeta",
    "Neha", "Pooja", "Sneha", "Manju", "Shanti", "Usha", "Radha", "Sita",
]
INDIAN_LAST_NAMES = [
    "Devi", "Kumari", "Singh", "Verma", "Gupta", "Sharma", "Yadav",
    "Patel", "Khan", "Begum",
]
INDIAN_MALE_NAMES = [
    "Rajesh", "Suresh", "Ramesh", "Dinesh", "Manoj", "Sanjay",
    "Vijay", "Amit", "Rahul", "Deepak",
]


def indian_name(gender="female"):
    first = INDIAN_FIRST_NAMES if gender == "female" else INDIAN_MALE_NAMES
    import random
    return f"{random.choice(first)} {random.choice(INDIAN_LAST_NAMES)}"


def indian_phone():
    import random
    return f"9{random.randint(600000000, 999999999)}"


class UserFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = User
        django_get_or_create = ("username",)

    username = factory.Sequence(lambda n: f"worker_{n}")
    phone = factory.Sequence(lambda n: f"+91{9}{n:09d}")
    role = User.Role.HEALTH_WORKER
    village = factory.Iterator(INDIAN_VILLAGES)
    block = factory.Iterator(INDIAN_BLOCKS)
    district = factory.Iterator(INDIAN_DISTRICTS)
    is_active = True


class SupervisorFactory(UserFactory):
    username = factory.Sequence(lambda n: f"supervisor_{n}")
    role = User.Role.SUPERVISOR


class AdminUserFactory(UserFactory):
    username = factory.Sequence(lambda n: f"admin_{n}")
    role = User.Role.ADMIN


class HouseholdFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Household

    household_code = factory.Sequence(lambda n: f"HH-SIT-{n:04d}")
    head_name = factory.LazyFunction(lambda: indian_name(gender="male"))
    head_name_hi = factory.LazyAttribute(lambda o: o.head_name)
    village = factory.Iterator(INDIAN_VILLAGES)
    block = factory.Iterator(INDIAN_BLOCKS)
    district = factory.Iterator(INDIAN_DISTRICTS)
    address = factory.LazyAttribute(lambda o: f"{o.village}, Block {o.block}")
    member_count = factory.Faker("random_int", min=2, max=8)
    is_active = True


class PatientFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Patient

    full_name = factory.LazyFunction(lambda: indian_name(gender="female"))
    name_hi = factory.LazyAttribute(lambda o: o.full_name)
    gender = "female"
    village = factory.Iterator(INDIAN_VILLAGES)
    block = factory.Iterator(INDIAN_BLOCKS)
    district = factory.Iterator(INDIAN_DISTRICTS)
    phone = factory.LazyFunction(indian_phone)
    date_of_birth = factory.LazyFunction(
        lambda: date.today() - timedelta(days=365 * 28)
    )
    diabetes = False
    hypertension = False
    tb_history = False
    prev_hospitalized = False
    pregnancy_status = False


class SurveyResponseFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = SurveyResponse

    patient = factory.SubFactory(PatientFactory)
    survey_type = "screening"
    answers = {}
    submitted_at = factory.LazyFunction(timezone.now)


class FlagFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Flag

    patient = factory.SubFactory(PatientFactory)
    flag_type = "clinical_risk"
    source = "risk_engine"
    severity = "medium"
    status = Flag.Status.OPEN
    explanation = {}
    score = 0


class FollowUpFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = FollowUp

    patient = factory.SubFactory(PatientFactory)
    worker = factory.SubFactory(UserFactory)
    scheduled_date = factory.LazyFunction(
        lambda: timezone.localdate() + timedelta(days=7)
    )
    urgency = FollowUp.Urgency.ROUTINE
    status = FollowUp.Status.PENDING


class ReferralFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = Referral

    patient = factory.SubFactory(PatientFactory)
    destination = "PHC Sitapur"
    reason = "Clinical evaluation needed"
    status = Referral.Status.DRAFT


class IncentiveFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = IncentiveLedgerEntry

    worker = factory.SubFactory(UserFactory)
    activity_type = IncentiveLedgerEntry.ActivityType.SURVEY_COMPLETION
    amount_paise = 5000
    status = IncentiveLedgerEntry.Status.PENDING
    month_year = factory.LazyFunction(
        lambda: timezone.now().strftime("%Y-%m")
    )


class RiskRuleFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = RiskRule
        django_get_or_create = ("code",)

    code = factory.Sequence(lambda n: f"RULE_{n}")
    name = factory.LazyAttribute(lambda o: o.code)
    field_path = "survey.answers.fever"
    operator = RiskRule.Operator.TRUTHY
    weight = 3
    category = RiskRule.Category.COMMUNICABLE
    is_active = True
    is_hard_flag = False
    severity = "medium"
    flag_type = "clinical_risk"
    rule_label_en = factory.LazyAttribute(lambda o: o.name)
    rule_label_hi = factory.LazyAttribute(lambda o: o.name)


class ANCVisitFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = ANCVisit

    patient = factory.SubFactory(PatientFactory)
    visit_number = 1
    visit_date = factory.LazyFunction(date.today)
    pog_weeks = 20
    weight_kg = 58.0
    pulse_rate = 78
    bp_systolic = 110
    bp_diastolic = 70
    pallor = "absent"
    oedema = "absent"
    jaundice = "absent"
    fundal_height_cm = 20.0
    lie_presentation = "cephalic"
    fetal_movements = "normal"
    fetal_heart_rate = 140
    hemoglobin_gms = 11.0
    urine_albumin = "negative"
    urine_sugar = "negative"
    gdm_screening = "negative"


class GrowthRecordFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = GrowthRecord

    patient = factory.SubFactory(PatientFactory)
    recorded_date = factory.LazyFunction(date.today)
    recorded_by = "ASHA"
    age_completed_months = 12.0
    weight_kg = 8.0
    height_cm = 72.0
    muac_cm = 14.0
    wfa_z_score = -1.0
    wfh_z_score = -0.5
    hfa_z_score = -0.8
    nutritional_status = "normal"
    is_faltering = False


class PNCVisitFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = PNCVisit

    mother_patient = factory.SubFactory(PatientFactory)
    visit_timing = "day_1"
    visit_date = factory.LazyFunction(date.today)
    mother_pallor = "absent"
    mother_pulse = 78
    mother_bp_sys = 110
    mother_bp_dia = 70
    mother_temp_f = 98.4
    breasts_condition = "normal"
    nipples_condition = "normal"
    uterus_tenderness = "absent"
    bleeding_pv = "normal"
    lochia = "normal"
    episiotomy = "healed"
    family_planning_counselled = False
    baby_urine = True
    baby_stool = True
    baby_convulsions = False
    baby_activity = "active"
    baby_sucking = "good"
    baby_breathing = "normal"
    baby_temp_f = 98.6
    baby_jaundice = False


class DevelopmentMilestoneCheckFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = DevelopmentMilestoneCheck

    patient = factory.SubFactory(PatientFactory)
    check_date = factory.LazyFunction(date.today)
    age_at_check_months = 12
    milestones_achieved = {}
    warning_signs = {}
    any_warning_sign = False


class ImmunizationRecordFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = ImmunizationRecord

    patient = factory.SubFactory(PatientFactory)
    vaccine_name = "BCG"
    dose_number = 1
    scheduled_date = factory.LazyFunction(date.today)
    status = "given"
    fic_eligible = False
    cic_eligible = False
    is_vitamin_a = False


class WorkerRegistrationFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = "accounts.WorkerRegistration"

    phone = factory.Sequence(lambda n: f"+91{9}{n:09d}")
    full_name = factory.LazyFunction(lambda: indian_name(gender="female"))
    supervisor = factory.SubFactory(SupervisorFactory)
    village = factory.Iterator(INDIAN_VILLAGES)
    block = factory.Iterator(INDIAN_BLOCKS)
    district = factory.Iterator(INDIAN_DISTRICTS)
    is_active = True


class CareInteractionFactory(factory.django.DjangoModelFactory):
    class Meta:
        model = CareInteraction

    patient = factory.SubFactory(PatientFactory)
    protocol = "anc_visit_records"
    payload = {}
