"use client";
import { useEffect, useRef, useState } from "react";
import { PublicPass } from "@/types/ticketing.types";

interface State {
  loading: boolean;
  error: string | null;
  paymentStatus: string | null;
  passes: PublicPass[];
  bookingReference: string | null;
  totalAmount: number | null;
  updatedAt: number;
}

// Payment statuses that will never change again - stop polling once reached.
// See lib/payments/status-map.ts deriveStateCode for the full status list.
const TERMINAL_STATUSES = new Set(["paid", "failed", "expired", "refunded"]);

// This screen is typically a payment/checkout confirmation page where the
// user is actively waiting, so poll fairly aggressively (Supabase Realtime
// is no longer available).
const POLL_MS = 5000;

export function useBookingRealtimeStatus(bookingId: number | null) {
  const [state, setState] = useState<State>({
    loading: !!bookingId,
    error: null,
    paymentStatus: null,
    passes: [],
    bookingReference: null,
    totalAmount: null,
    updatedAt: Date.now(),
  });
  const passIdsRef = useRef<Set<number>>(new Set());

  // Initial snapshot
  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;
    (async () => {
      const statusRes = await fetch(
        `/api/payments/status?booking_id=${bookingId}`
      );
      if (!cancelled && statusRes.ok) {
        const json = await statusRes.json();
        setState((s) => ({
          ...s,
          paymentStatus: json.payment_status ?? s.paymentStatus,
          bookingReference: json.booking_reference ?? s.bookingReference,
          updatedAt: Date.now(),
          loading: false,
        }));
      } else if (!cancelled) {
        setState((s) => ({ ...s, loading: false }));
      }
      const passesRes = await fetch(
        `/api/tickets/passes?booking_id=${bookingId}`
      );
      if (!cancelled && passesRes.ok) {
        const json = await passesRes.json();
        const passes: PublicPass[] = json.passes || [];
        passIdsRef.current = new Set(passes.map((p) => p.id));
        setState((s) => ({
          ...s,
          passes,
          totalAmount: json.total_amount ?? s.totalAmount,
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  // Poll for status + pass updates until a terminal payment status is reached.
  useEffect(() => {
    if (!bookingId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      try {
        const statusRes = await fetch(
          `/api/payments/status?booking_id=${bookingId}`
        );
        let latestStatus: string | null = null;
        if (!cancelled && statusRes.ok) {
          const json = await statusRes.json();
          latestStatus = json.payment_status ?? null;
          setState((s) => ({
            ...s,
            paymentStatus: latestStatus ?? s.paymentStatus,
            bookingReference: json.booking_reference ?? s.bookingReference,
            updatedAt: Date.now(),
          }));
        }

        const passesRes = await fetch(
          `/api/tickets/passes?booking_id=${bookingId}`
        );
        if (!cancelled && passesRes.ok) {
          const json = await passesRes.json();
          const passes: PublicPass[] = json.passes || [];
          const newPasses = passes.filter(
            (p) => !passIdsRef.current.has(p.id)
          );
          if (newPasses.length > 0 || passes.length !== passIdsRef.current.size) {
            passIdsRef.current = new Set(passes.map((p) => p.id));
            setState((s) => ({
              ...s,
              passes,
              totalAmount: json.total_amount ?? s.totalAmount,
            }));
          }
        }

        if (cancelled) return;

        // Stop polling once we've reached a terminal payment status.
        if (latestStatus && TERMINAL_STATUSES.has(latestStatus)) {
          return;
        }
      } catch (error) {
        console.warn("[useBookingRealtimeStatus] Poll failed:", error);
      }

      if (!cancelled) {
        timer = setTimeout(poll, POLL_MS);
      }
    };

    timer = setTimeout(poll, POLL_MS);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [bookingId]);

  return state;
}
