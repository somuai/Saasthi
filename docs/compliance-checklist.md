# Compliance Checklist

## Consent And Privacy

- [ ] Consent captured before first clinical encounter.
- [ ] Consent language and timestamp stored.
- [ ] Aadhaar stored only as last 4 digits.
- [ ] Analytics exports anonymized or aggregated by default.
- [ ] PII access restricted by role and geography.

## ASHA Workflow Integrity

- [ ] Offline capture works without network.
- [ ] All writes include worker, device, timestamp, app version, and sync metadata.
- [ ] ASHA incentives reward verified activity, timely follow-up, case progression, closure, or immunization completion.
- [ ] No per-patient commission or referral-volume reward logic exists.

## MCP Safety

- [ ] Pregnancy, newborn, diarrhea/pneumonia, malnutrition, and immunization danger signs trigger visible referral prompts.
- [ ] The app does not collect or infer prenatal fetal sex.
- [ ] EDD, ANC, PNC, vaccine, growth, IFA, deworming, and milestone due dates are generated locally.

## Auditability

- [ ] Create, edit, approve, referral, incentive, and sync actions write audit events.
- [ ] Sync failures are visible to ASHA and supervisor/admin users.
- [ ] Rule evaluations store model/rule version and triggered factors.

