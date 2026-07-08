"use client";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
  const fallbackTimer = useRef<number | null>(null);
  const supabase = useRef(createClient());

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
        setState((s) => ({
          ...s,
          passes: json.passes || [],
          totalAmount: json.total_amount ?? s.totalAmount,
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  // Realtime channel
  useEffect(() => {
    if (!bookingId) return;
    const client = supabase.current;
    const channel = client
      .channel(`booking:${bookingId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
          filter: `id=eq.${bookingId}`,
        },
        (payload) => {
          const newRow = payload.new as {
            payment_status?: string | null;
            booking_reference?: string | null;
          };
          setState((s) => ({
            ...s,
            paymentStatus: newRow.payment_status ?? s.paymentStatus,
            bookingReference: newRow.booking_reference ?? s.bookingReference,
            updatedAt: Date.now(),
          }));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_passes",
          filter: `booking_id=eq.${bookingId}`,
        },
        (payload) => {
          const newPass = payload.new as PublicPass;
          setState((s) => {
            if (s.passes.find((p) => p.id === newPass.id)) return s;
            return { ...s, passes: [...s.passes, newPass] };
          });
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Fallback poll if no terminal state after 25s
          fallbackTimer.current = window.setTimeout(async () => {
            const statusRes = await fetch(
              `/api/payments/status?booking_id=${bookingId}`
            );
            if (statusRes.ok) {
              const json = await statusRes.json();
              setState((s) => ({
                ...s,
                paymentStatus: json.payment_status ?? s.paymentStatus,
                bookingReference: json.booking_reference ?? s.bookingReference,
                updatedAt: Date.now(),
              }));
            }
          }, 25000);
        }
      });
    return () => {
      if (fallbackTimer.current) window.clearTimeout(fallbackTimer.current);
      client.removeChannel(channel);
    };
  }, [bookingId]);

  return state;
}
