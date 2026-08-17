import json
import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from registry.models import Household, Patient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import WorkerRegistration

User = get_user_model()


class Command(BaseCommand):
    help = "Seeds 1000 ASHA workers and 100 admins for load testing, generating a JSON file of tokens."

    def handle(self, *args, **options):
        output_file = os.path.join(os.getcwd(), "users.json")
        os.makedirs(os.path.dirname(output_file), exist_ok=True)

        self.stdout.write("Creating 100 Admins...")
        admins = []
        for i in range(1, 101):
            phone = f"+9199000{i:05d}"
            admin, _ = User.objects.get_or_create(
                phone=phone,
                defaults={
                    "username": phone,
                    "first_name": f"Admin {i}",
                    "role": User.Role.ADMIN,
                    "is_staff": True,
                    "is_superuser": True,
                    "is_active": True,
                },
            )
            refresh = RefreshToken.for_user(admin)
            admins.append({"phone": phone, "token": str(refresh.access_token)})

        self.stdout.write("Creating 1000 ASHA Workers and initial data...")
        ashas = []
        for i in range(1, 1001):
            phone = f"+9188000{i:05d}"

            user, created = User.objects.get_or_create(
                phone=phone,
                defaults={
                    "username": phone,
                    "first_name": f"ASHA {i}",
                    "role": User.Role.HEALTH_WORKER,
                    "village": f"Village {i % 100}",
                    "block": "Test Block",
                    "district": "Test District",
                    "region": "Test Region",
                    "is_active": True,
                },
            )

            WorkerRegistration.objects.get_or_create(
                phone=phone,
                defaults={
                    "full_name": f"ASHA {i}",
                    "village": user.village,
                    "block": user.block,
                    "district": user.district,
                    "region": user.region,
                    "is_active": True,
                    "created_by": User.objects.filter(role=User.Role.ADMIN).first(),
                    "supervisor": User.objects.filter(role=User.Role.ADMIN).first(),
                },
            )

            # Add one household and one patient for sync pulling
            household, _ = Household.objects.get_or_create(
                household_code=f"HH-{i}",
                defaults={
                    "head_name": f"Head {i}",
                    "address": f"Address {i}",
                    "village": user.village,
                    "block": user.block,
                    "district": user.district,
                    "created_by": user,
                    "is_active": True,
                },
            )
            Patient.objects.get_or_create(
                household=household,
                full_name=f"Patient {i}",
                defaults={
                    "date_of_birth": "1994-01-01",
                    "gender": "female",
                    "village": user.village,
                    "block": user.block,
                    "district": user.district,
                    "region": user.region,
                    "created_by": user,
                    "status": "active",
                },
            )

            refresh = RefreshToken.for_user(user)
            ashas.append({"phone": phone, "token": str(refresh.access_token), "server_id": str(user.local_uuid)})

            if i % 100 == 0:
                self.stdout.write(f" Created {i} workers...")

        with open(output_file, "w") as f:
            json.dump({"admins": admins, "ashas": ashas}, f)

        self.stdout.write(self.style.SUCCESS(f"Successfully generated tokens and saved to {output_file}"))
