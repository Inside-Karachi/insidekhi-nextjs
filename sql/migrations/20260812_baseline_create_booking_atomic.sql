-- Baseline reference: create_booking_atomic is already live in prod and used
-- by app/api/bookings/create/route.ts (the web checkout path). That route's
-- own comment claims this function "is defined in
-- sql/migrations/20260311_security_atomic_booking_rpc.sql" - that file does
-- not exist in this repo. This migration is the actual first version-control
-- record of it, so the function can finally be reviewed/diffed like any
-- other code. No behavior change - this is CREATE OR REPLACE of the exact
-- live definition, pulled verbatim on 2026-08-12.

CREATE OR REPLACE FUNCTION public.create_booking_atomic(p_user_id uuid, p_event_id bigint, p_total_amount numeric, p_basket_id text, p_booking_reference text, p_verification_seed text, p_expires_at timestamp with time zone, p_cnic_hash text, p_cnic_last4 text, p_customer_name text, p_customer_email text, p_customer_phone text, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_booking_id bigint;
  v_item       jsonb;
BEGIN
  SELECT id INTO v_booking_id
  FROM public.bookings
  WHERE user_id = p_user_id
    AND basket_id = p_basket_id
    AND payment_status IN ('awaiting_payment', 'pending')
  LIMIT 1;

  IF v_booking_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'booking_id',        v_booking_id,
      'booking_reference', p_booking_reference
    );
  END IF;

  INSERT INTO public.bookings (
    user_id, event_id, total_amount, basket_id,
    booking_reference, verification_seed, expires_at,
    cnic_hash, cnic_last4,
    customer_name, customer_email, customer_phone,
    status, payment_status
  )
  VALUES (
    p_user_id, p_event_id, p_total_amount, p_basket_id,
    p_booking_reference, p_verification_seed, p_expires_at,
    p_cnic_hash, p_cnic_last4,
    p_customer_name, p_customer_email, p_customer_phone,
    'pending', 'awaiting_payment'
  )
  ON CONFLICT (user_id, basket_id) DO NOTHING
  RETURNING id INTO v_booking_id;

  IF v_booking_id IS NULL THEN
    SELECT id INTO v_booking_id
    FROM public.bookings
    WHERE user_id = p_user_id AND basket_id = p_basket_id
    LIMIT 1;

    IF v_booking_id IS NULL THEN
      RAISE EXCEPTION 'create_booking_atomic: failed to create or retrieve booking for basket %', p_basket_id;
    END IF;

    RETURN jsonb_build_object(
      'booking_id',        v_booking_id,
      'booking_reference', p_booking_reference
    );
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.booking_items (
      booking_id,
      ticket_type_id,
      quantity,
      price_per_ticket
    )
    VALUES (
      v_booking_id,
      (v_item->>'ticket_type_id')::bigint,
      (v_item->>'quantity')::integer,
      (v_item->>'price_per_ticket')::numeric
    );
  END LOOP;

  RETURN jsonb_build_object(
    'booking_id',        v_booking_id,
    'booking_reference', p_booking_reference
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'create_booking_atomic failed: %', SQLERRM;
END;
$function$;
