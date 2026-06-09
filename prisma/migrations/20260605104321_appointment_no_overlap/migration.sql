-- Prevent double-booking at the database level.
--
-- For a single doctor, two appointments in `booked` status may not have
-- overlapping time intervals. This is enforced with a GiST exclusion
-- constraint and is stronger than a UNIQUE(doctorId, startsAt) because
-- appointments can have different durations.
--
-- Note on range type: Prisma maps `DateTime` to `timestamp(3)` (without time
-- zone) and stores UTC values, so we use `tsrange` (not `tstzrange`) to match
-- the actual column type. Overlap detection is timezone-independent because all
-- stored values are UTC. See docs/03-data-model.md and docs/07-runbook-dev-deploy.md.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Appointment"
ADD CONSTRAINT "appointment_no_overlap"
EXCLUDE USING gist (
  "doctorId" WITH =,
  tsrange("startsAt", "endsAt", '[)') WITH &&
)
WHERE ("status" = 'booked');
