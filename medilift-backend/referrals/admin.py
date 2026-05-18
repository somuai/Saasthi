from django.contrib import admin

from .models import Referral


@admin.register(Referral)
class ReferralAdmin(admin.ModelAdmin):
    list_display = ("local_uuid", "patient", "destination", "status", "updated_at")
    list_filter = ("status", "destination")
    search_fields = ("local_uuid", "patient__full_name", "destination")
