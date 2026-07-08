"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useBookingRealtimeStatus } from "@/hooks/useBookingRealtimeStatus";
import { BookingPassList } from "@/components/events/BookingPassList";

export function BookingPassReturnContent() {
  const params = useSearchParams();
  const bookingId = params.get("booking_id");
  const idNum = bookingId ? parseInt(bookingId, 10) : null;
  const { paymentStatus, passes, bookingReference } =
    useBookingRealtimeStatus(idNum);

  const terminal = ["paid", "failed", "refunded", "expired"].includes(
    (paymentStatus || "").toLowerCase(),
  );

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-neutral-700/60 bg-neutral-900/60 p-4 backdrop-blur">
        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="opacity-70">Booking</span>
            <span className="font-mono text-xs opacity-90">
              {bookingReference || idNum}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="opacity-70">Status</span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium capitalize border ${
                paymentStatus === "paid"
                  ? "bg-green-600/20 border-green-500/40 text-green-300"
                  : paymentStatus === "failed"
                    ? "bg-red-600/20 border-red-500/40 text-red-300"
                    : paymentStatus === "expired"
                      ? "bg-yellow-700/20 border-yellow-600/40 text-yellow-300"
                      : "bg-neutral-800 border-neutral-600 text-neutral-300 animate-pulse"
              }`}
            >
              {paymentStatus || "processing"}
            </span>
          </div>
          {terminal && paymentStatus === "paid" && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] leading-relaxed">
              <p className="text-green-300">
                Payment confirmed. Your passes are below.
              </p>
              <Link
                href="/dashboard/bookings"
                className="text-primary hover:text-primary/80 font-medium tracking-wide"
              >
                View all bookings
              </Link>
            </div>
          )}
        </div>
      </div>
      {passes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold tracking-wide uppercase opacity-70">
            Passes
          </h3>
          <BookingPassList passes={passes} />
        </div>
      )}
      {terminal && passes.length === 0 && paymentStatus === "paid" && (
        <div className="text-xs opacity-70">Issuing passes…</div>
      )}
      {!terminal && (
        <div className="text-xs opacity-60">
          Waiting for provider confirmation…
        </div>
      )}
    </div>
  );
}
