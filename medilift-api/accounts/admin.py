from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import AuditLog, OTPChallenge, User


@admin.register(User)
class MediliftUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("SAASTHI", {"fields": ("local_uuid", "phone", "role", "region", "district", "block", "village", "metadata")}),
    )
    readonly_fields = ("local_uuid",)
    list_display = ("username", "phone", "role", "district", "block", "is_staff")
    list_filter = ("role", "district", "block", "is_staff")


@admin.register(OTPChallenge)
class OTPChallengeAdmin(admin.ModelAdmin):
    list_display = ("phone", "purpose", "expires_at", "consumed_at", "attempts", "created_at")
    search_fields = ("phone",)


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("action", "resource_type", "resource_id", "actor", "created_at")
    list_filter = ("action", "resource_type")
