from django.core.management.base import BaseCommand

from incentives.models import IncentiveRate

DEFAULT_RATES = [
    ("survey_completion", 5000, "Survey completion", "सर्वेक्षण पूर्णता"),
    ("high_risk_identification", 15000, "High risk identification", "उच्च जोखिम पहचान"),
    ("hard_flag_referral", 20000, "Hard flag referral", "हार्ड फ्लैग रेफरल"),
    ("followup_completed_on_time", 7500, "Follow-up completed on time", "समय पर अनुवर्तन पूर्णता"),
    ("followup_missed", 0, "Follow-up missed", "अनुवर्तन छूट गया"),
    ("anc_registration", 30000, "ANC registration", "एएनसी पंजीकरण"),
]


class Command(BaseCommand):
    help = "Seeds default incentive rates into the IncentiveRate table."

    def handle(self, *args, **options):
        created_count = 0
        updated_count = 0
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
            self.stdout.write(f"  {'Created' if created else 'Updated'}: {obj}")

        self.stdout.write(self.style.SUCCESS(f"Done. {created_count} created, {updated_count} updated."))
