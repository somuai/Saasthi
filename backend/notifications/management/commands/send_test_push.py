from accounts.models import User
from django.core.management.base import BaseCommand

from notifications.services import send_fcm_notification


class Command(BaseCommand):
    help = "Send a test push notification to a user by phone number or to all FCM-enabled users"

    def add_arguments(self, parser):
        parser.add_argument("--phone", type=str, help="Send to a specific user by phone")
        parser.add_argument("--all", action="store_true", help="Send to all FCM-enabled users")
        parser.add_argument("--title", type=str, default="Test Notification")
        parser.add_argument("--body", type=str, default="This is a test push from Shaasthi.")

    def handle(self, *args, **options):
        title = options["title"]
        body = options["body"]

        if options["phone"]:
            users = User.objects.filter(phone=options["phone"], fcm_token__gt="")
            if not users.exists():
                self.stderr.write(f"No user with phone '{options['phone']}' and FCM token.")
                return
        elif options["all"]:
            users = User.objects.filter(fcm_token__gt="", notifications_enabled=True)
            if not users.exists():
                self.stderr.write("No users with FCM tokens.")
                return
        else:
            self.stderr.write("Specify --phone or --all")
            return

        for user in users:
            ok = send_fcm_notification(user, title, body)
            status = "✓" if ok else "✗"
            self.stdout.write(f"{status} {user.phone} ({user.first_name or 'N/A'})")

        self.stdout.write(f"Done. Sent to {len(users)} user(s).")
