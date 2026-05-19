from django.contrib import admin

from .models import Household, Patient


@admin.register(Household)
class HouseholdAdmin(admin.ModelAdmin):
    list_display = ("local_uuid", "district", "block", "village", "updated_at")
    list_filter = ("district", "block", "village")
    search_fields = ("local_uuid", "address")


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    list_display = ("full_name", "gender", "district", "block", "village", "status", "updated_at")
    list_filter = ("gender", "status", "district", "block")
    search_fields = ("full_name", "phone", "local_uuid")
