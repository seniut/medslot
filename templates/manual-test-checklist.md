# Manual Test Checklist

## Public booking

- [ ] `/pl/booking` loads in Polish.
- [ ] `/en/booking` loads in English.
- [ ] Only free slots are shown.
- [ ] No patient data is visible publicly.
- [ ] Required fields are validated.
- [ ] Invalid email is rejected.
- [ ] Privacy checkbox is required.
- [ ] Booking creates appointment.
- [ ] Confirmation email is sent.
- [ ] Same slot cannot be booked twice.

## Cancellation

- [ ] Confirmation email contains cancellation link.
- [ ] Cancellation page opens with valid token.
- [ ] Invalid token fails safely.
- [ ] Cancelled appointment gets `cancelled_by_patient`.
- [ ] Cancelled future slot becomes available.
- [ ] Appointment remains in admin history.

## Admin

- [ ] Admin routes require login.
- [ ] Calendar shows patient names.
- [ ] Appointment details show patient contacts.
- [ ] Manual appointment can be created.
- [ ] Manual appointment cannot overlap existing booking.
- [ ] Appointment can be marked completed.
- [ ] Appointment can be marked no-show.
- [ ] Doctor can cancel appointment.
- [ ] Notes can be added.
- [ ] Notes warning is visible.

## Working hours

- [ ] Doctor can update working days.
- [ ] Disabled days disappear from public availability.
- [ ] Changed hours affect available slots.
- [ ] Blocked time is not bookable.

## Export/copy

- [ ] Copy patient info works.
- [ ] Copy visit summary works.
- [ ] CSV export by date range works.
- [ ] Export is admin-only.
- [ ] Export action is audited.

## GDPR/privacy

- [ ] Consent record is created.
- [ ] Privacy policy version is stored.
- [ ] Audit logs are created for important actions.
- [ ] Logs do not contain note content or raw tokens.

