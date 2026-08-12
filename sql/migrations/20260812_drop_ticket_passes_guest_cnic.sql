-- CNIC privacy hardening, part 2 of 2. Run only after
-- 20260812_cnic_hash_hardening.sql has been deployed and confirmed live
-- (verify via a couple of real test bookings that ticket_passes.guest_cnic
-- stays NULL and bookings.cnic_hash is a 64-char hex string).
--
-- Row-count audit on 2026-08-12 found 0 of 7 ticket_passes rows had a raw
-- guest_cnic value, and no code path (web checkout, mobile checkout,
-- admin_mark_booking_paid, generate_ticket_passes, the PayFast callback)
-- writes to this column - it's dead at rest. No backfill/null-out cycle is
-- needed; this goes straight to dropping the column.
--
-- Take a pg_dump of ticket_passes before running this, outside peak hours,
-- per the plan's standard precaution for destructive schema changes.

ALTER TABLE public.ticket_passes DROP COLUMN IF EXISTS guest_cnic;
