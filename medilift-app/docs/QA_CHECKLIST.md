# MEDILIFT — manual QA checklist (post-build)

- [ ] Login → OTP → home; persisted session after app restart
- [ ] Add patient (3 steps) → appears in list with risk badge
- [ ] Survey submit → `survey_responses` row, patient risk updated, follow-up if not low, incentive row
- [ ] Sync screen shows pending count; pull/push when backend running with JWT
- [ ] Offline: NetInfo drives banner; DB writes succeed without network
- [ ] Bilingual labels on new gov components; tap targets ≥ 52px on primary flows
- [ ] No referral-commission strings in UI or code paths
