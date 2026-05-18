from django.db import models
from django.utils import timezone


class OTPRecord(models.Model):
    phone = models.CharField(max_length=15, db_index=True)
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    class Meta:
        db_table = "otp_records"
        ordering = ["-created_at"]

    def is_valid(self):
        return not self.is_used and timezone.now() < self.expires_at
