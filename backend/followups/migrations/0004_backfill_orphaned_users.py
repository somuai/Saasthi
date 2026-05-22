from django.db import migrations


def backfill_orphaned_users(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    FollowUp = apps.get_model("followups", "FollowUp")
    Patient = apps.get_model("registry", "Patient")

    orphaned = User.objects.filter(
        role="health_worker", is_active=False, requires_review=True
    ).order_by("id")

    for user in orphaned:
        phone = user.phone
        if not phone:
            continue
        patient, _ = Patient.objects.get_or_create(
            phone=phone,
            defaults={
                "full_name": user.first_name or phone,
                "age": 0,
                "gender": "unknown",
                "village": user.village or "",
                "created_by": user,
            },
        )
        FollowUp.objects.get_or_create(
            patient=patient,
            created_by=user,
            follow_type="field_visit",
            defaults={
                "notes": "Auto-migrated from orphaned user registration",
                "source": "backfill",
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("followups", "0003_visit_otp"),
        ("registry", "0001_initial"),
    ]
    operations = [
        migrations.RunPython(backfill_orphaned_users, migrations.RunPython.noop),
    ]
