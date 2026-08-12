-- CNIC privacy hardening, part 1 of 2 (see also
-- 20260812_drop_ticket_passes_guest_cnic.sql, applied after this one is
-- confirmed live and no new raw writes are observed).
--
-- Two changes:
--
-- 1. create_booking_with_reservation (the mobile checkout RPC, called by
--    app/api/mobile/v1/checkout/route.ts) currently accepts a raw
--    p_customer_cnic and hashes it DB-side before storing it on `bookings`
--    (it never touches ticket_passes). That's not an active data-at-rest
--    leak, but it does mean a raw 13-digit CNIC crosses the network into an
--    unreviewed function on every mobile checkout. This patch moves hashing
--    to the API layer (lib/utils/cnic-server.ts) so the RPC never receives
--    the raw value at all - mirroring create_booking_atomic's existing
--    p_cnic_hash/p_cnic_last4 parameters. Must ship together with the
--    app/api/mobile/v1/checkout/route.ts change in the same deploy, since
--    the route's RPC call signature has to match this function's signature.
--
-- 2. get_event_attendees has no callers anywhere in the codebase today, but
--    its signature still returns tp.guest_cnic (raw CNIC). It was found
--    during this investigation, not in the original CNIC-fix scope. Since
--    ticket_passes.guest_cnic is being dropped next, this function would
--    start erroring on any future call unless patched now. Replaced to
--    return cnic_last4 instead - all it's for is door-side ID matching by
--    organizers, which only ever needs the last 4 digits.

-- ============================================================
-- Original create_booking_with_reservation, kept for rollback reference
-- (pulled verbatim 2026-08-12, before this patch):
-- ============================================================
-- CREATE OR REPLACE FUNCTION public.create_booking_with_reservation(p_user_id uuid, p_items jsonb, p_customer_name text, p_customer_email text, p_customer_phone text, p_customer_cnic text, p_basket_id text DEFAULT NULL::text)
--  RETURNS bigint
--  LANGUAGE plpgsql
--  SECURITY DEFINER
--  SET search_path TO 'public', 'extensions', 'pg_temp'
-- AS $function$
-- DECLARE
--   v_booking_id bigint;
--   v_total numeric(12,2) := 0;
--   v_now timestamptz := now();
--   v_item jsonb;
--   v_ticket record;
--   v_quantity int;
--   v_per_person_limit int;
--   v_existing_cnic_count int;
--   v_booking_reference text := substr(replace(gen_random_uuid()::text,'-',''),1,12);
--   v_verification_seed text := substr(replace(gen_random_uuid()::text,'-',''),1,24);
--   v_cnic_hash text;
--   v_cnic_last4 text;
--   v_event_id bigint := NULL;
-- BEGIN
--   IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
--     RAISE EXCEPTION 'No ticket items provided';
--   END IF;
--
--   IF p_customer_cnic IS NULL OR p_customer_cnic !~ '^[0-9]{13}$' THEN
--     RAISE EXCEPTION 'Invalid CNIC';
--   END IF;
--
--   v_cnic_hash := encode(digest(p_customer_cnic, 'sha256'),'hex');
--   v_cnic_last4 := right(p_customer_cnic,4);
--   -- ... (rest unchanged, see this file's new version below for full body)
-- $function$
-- ============================================================

-- The new signature has a different parameter count (7 -> 8: p_customer_cnic
-- split into p_cnic_hash + p_cnic_last4). Postgres identifies functions by
-- (name, parameter types), so CREATE OR REPLACE with a different arg list
-- does NOT replace the original - it silently creates a second, overloaded
-- function, leaving the old raw-CNIC-accepting version live and callable.
-- The DROP below is required to actually retire it.
DROP FUNCTION IF EXISTS public.create_booking_with_reservation(uuid, jsonb, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.create_booking_with_reservation(
  p_user_id uuid,
  p_items jsonb,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_cnic_hash text,
  p_cnic_last4 text,
  p_basket_id text DEFAULT NULL::text
)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_booking_id bigint;
  v_total numeric(12,2) := 0;
  v_now timestamptz := now();
  v_item jsonb;
  v_ticket record;
  v_quantity int;
  v_per_person_limit int;
  v_existing_cnic_count int;
  v_booking_reference text := substr(replace(gen_random_uuid()::text,'-',''),1,12);
  v_verification_seed text := substr(replace(gen_random_uuid()::text,'-',''),1,24);
  v_cnic_hash text;
  v_cnic_last4 text;
  v_event_id bigint := NULL;
BEGIN
  -- Validate inputs
  IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'No ticket items provided';
  END IF;

  IF p_cnic_hash IS NULL OR p_cnic_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid CNIC hash';
  END IF;

  IF p_cnic_last4 IS NULL OR p_cnic_last4 !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'Invalid CNIC last4';
  END IF;

  -- CNIC arrives pre-hashed from the API layer (lib/utils/cnic-server.ts) -
  -- this function never sees the raw value.
  v_cnic_hash := p_cnic_hash;
  v_cnic_last4 := p_cnic_last4;

  -- ==========================================
  -- IDEMPOTENCY CHECK: If basket_id provided, check if booking already exists
  -- ==========================================
  IF p_basket_id IS NOT NULL THEN
    SELECT id INTO v_booking_id
    FROM bookings
    WHERE user_id = p_user_id
      AND basket_id = p_basket_id
      AND payment_status IN ('awaiting_payment', 'pending');

    -- If booking exists, return it (idempotent)
    IF v_booking_id IS NOT NULL THEN
      RAISE NOTICE 'Returning existing booking % for basket %', v_booking_id, p_basket_id;
      RETURN v_booking_id;
    END IF;
  END IF;

  -- ==========================================
  -- VALIDATION: Check all tickets and calculate total
  -- ==========================================
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    -- Lock ticket type row for update to prevent race conditions
    SELECT * INTO v_ticket
    FROM ticket_types
    WHERE id = (v_item->>'ticket_type_id')::bigint
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ticket type % not found', (v_item->>'ticket_type_id');
    END IF;

    -- Ensure all tickets belong to same event
    IF v_event_id IS NULL THEN
      v_event_id := v_ticket.event_id;
    ELSIF v_event_id <> v_ticket.event_id THEN
      RAISE EXCEPTION 'Mixed event ticket types not allowed';
    END IF;

    -- Validate quantity
    v_quantity := (v_item->>'quantity')::int;
    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity for ticket type %', v_ticket.id;
    END IF;

    -- Check sale window
    IF v_now < v_ticket.sale_starts_at OR v_now > v_ticket.sale_ends_at THEN
      RAISE EXCEPTION 'Sale window closed for %', v_ticket.name;
    END IF;

    -- Check availability
    IF v_ticket.quantity_available IS NOT NULL AND v_ticket.quantity_available < v_quantity THEN
      RAISE EXCEPTION 'Insufficient quantity for %', v_ticket.name;
    END IF;

    -- Check per-person limit
    v_per_person_limit := COALESCE(v_ticket.max_per_person, 10);

    SELECT COALESCE(SUM(bi.quantity),0) INTO v_existing_cnic_count
    FROM bookings b
    JOIN booking_items bi ON bi.booking_id = b.id
    WHERE b.event_id = v_ticket.event_id
      AND b.cnic_hash = v_cnic_hash
      AND bi.ticket_type_id = v_ticket.id
      AND b.payment_status IN ('awaiting_payment','paid');

    IF v_existing_cnic_count + v_quantity > v_per_person_limit THEN
      RAISE EXCEPTION 'Per-person limit exceeded for % (limit %)', v_ticket.name, v_per_person_limit;
    END IF;

    -- Accumulate total
    v_total := v_total + (v_ticket.price * v_quantity);
  END LOOP;

  IF v_event_id IS NULL THEN
    RAISE EXCEPTION 'Could not determine event_id';
  END IF;

  -- ==========================================
  -- CREATE BOOKING: Insert with basket_id atomically
  -- ==========================================
  INSERT INTO bookings(
    user_id,
    event_id,
    total_amount,
    status,
    customer_name,
    customer_email,
    customer_phone,
    payment_status,
    booking_reference,
    verification_seed,
    cnic_hash,
    cnic_last4,
    basket_id,
    expires_at
  ) VALUES (
    p_user_id,
    v_event_id,
    v_total,
    'pending',
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    'awaiting_payment',
    v_booking_reference,
    v_verification_seed,
    v_cnic_hash,
    v_cnic_last4,
    p_basket_id,
    v_now + INTERVAL '15 minutes'
  )
  ON CONFLICT (user_id, basket_id) DO NOTHING
  RETURNING id INTO v_booking_id;

  -- ==========================================
  -- HANDLE CONFLICT: If ON CONFLICT triggered, fetch existing booking
  -- ==========================================
  IF v_booking_id IS NULL AND p_basket_id IS NOT NULL THEN
    SELECT id INTO v_booking_id
    FROM bookings
    WHERE user_id = p_user_id AND basket_id = p_basket_id;

    IF v_booking_id IS NOT NULL THEN
      RAISE NOTICE 'Conflict: Returning existing booking % for basket %', v_booking_id, p_basket_id;
      RETURN v_booking_id;
    ELSE
      RAISE EXCEPTION 'Failed to create or retrieve booking';
    END IF;
  END IF;

  -- ==========================================
  -- CREATE BOOKING ITEMS & DECREMENT INVENTORY
  -- ==========================================
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_ticket
    FROM ticket_types
    WHERE id = (v_item->>'ticket_type_id')::bigint
    FOR UPDATE;

    v_quantity := (v_item->>'quantity')::int;

    INSERT INTO booking_items(
      booking_id,
      ticket_type_id,
      quantity,
      price_per_ticket
    ) VALUES (
      v_booking_id,
      v_ticket.id,
      v_quantity,
      v_ticket.price
    );

    IF v_ticket.quantity_available IS NOT NULL THEN
      UPDATE ticket_types
      SET quantity_available = quantity_available - v_quantity
      WHERE id = v_ticket.id;
    END IF;
  END LOOP;

  RETURN v_booking_id;
END;
$function$;

-- ============================================================
-- Original get_event_attendees, kept for rollback reference
-- (pulled verbatim 2026-08-12, before this patch). Not previously
-- version-controlled; found during this investigation, not in the
-- original CNIC-fix scope.
-- ============================================================
-- CREATE OR REPLACE FUNCTION public.get_event_attendees(p_user_id uuid, p_event_id bigint)
--  RETURNS TABLE(pass_id bigint, pass_code text, guest_name text, guest_cnic text, ticket_type text, status text, checked_in_at timestamp with time zone, issued_at timestamp with time zone)
--  ...
--  SELECT tp.id, tp.code, tp.guest_name, tp.guest_cnic, tt.name, tp.status::text, tp.checked_in_at, tp.issued_at
--  FROM ticket_passes tp JOIN ticket_types tt ON tt.id = tp.ticket_type_id
--  WHERE tp.event_id = p_event_id ORDER BY tp.issued_at DESC;
-- ============================================================

-- Postgres disallows changing a function's return type via CREATE OR
-- REPLACE (the guest_cnic -> cnic_last4 column rename changes the return
-- row type), so the old definition must be dropped first.
DROP FUNCTION IF EXISTS public.get_event_attendees(uuid, bigint);

CREATE OR REPLACE FUNCTION public.get_event_attendees(p_user_id uuid, p_event_id bigint)
 RETURNS TABLE(pass_id bigint, pass_code text, guest_name text, cnic_last4 text, ticket_type text, status text, checked_in_at timestamp with time zone, issued_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_organizer boolean;
BEGIN
  SELECT is_event_organizer(p_user_id, p_event_id) INTO v_is_organizer;

  IF NOT v_is_organizer THEN
    RAISE EXCEPTION 'Access denied: User is not the organizer of this event';
  END IF;

  RETURN QUERY
  SELECT
    tp.id as pass_id,
    tp.code as pass_code,
    tp.guest_name,
    tp.cnic_last4,
    tt.name as ticket_type,
    tp.status::text,
    tp.checked_in_at,
    tp.issued_at
  FROM ticket_passes tp
  JOIN ticket_types tt ON tt.id = tp.ticket_type_id
  WHERE tp.event_id = p_event_id
  ORDER BY tp.issued_at DESC;
END;
$function$;
