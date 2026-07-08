import {
  BookingPaymentStatus,
  NormalizedGatewayStatus,
} from "@/types/payments.types";

// Map external (GoPayFast) raw statuses to internal booking_payment_status_enum values.
const RAW_TO_INTERNAL: Record<string, NormalizedGatewayStatus> = {
  INITIATED: { raw: "INITIATED", normalized: "awaiting_payment", final: false },
  PENDING: { raw: "PENDING", normalized: "awaiting_payment", final: false },
  PROCESSING: {
    raw: "PROCESSING",
    normalized: "awaiting_payment",
    final: false,
  },
  PAID: { raw: "PAID", normalized: "paid", final: true },
  SUCCESS: { raw: "SUCCESS", normalized: "paid", final: true },
  FAILED: { raw: "FAILED", normalized: "failed", final: true },
  CANCELED: { raw: "CANCELED", normalized: "failed", final: true },
  CANCELLED: { raw: "CANCELLED", normalized: "failed", final: true },
  EXPIRED: { raw: "EXPIRED", normalized: "expired", final: true },
  REFUNDED: { raw: "REFUNDED", normalized: "refunded", final: true },
  "00": { raw: "00", normalized: "paid", final: true },
  "000": { raw: "000", normalized: "paid", final: true },
  "0000": { raw: "0000", normalized: "paid", final: true },
  OTP_REQUIRED: {
    raw: "OTP_REQUIRED",
    normalized: "awaiting_payment",
    final: false,
  },
  OTP_SENT: {
    raw: "OTP_SENT",
    normalized: "awaiting_payment",
    final: false,
  },
  AWAITING_OTP: {
    raw: "AWAITING_OTP",
    normalized: "awaiting_payment",
    final: false,
  },
};

export function mapGatewayStatus(
  raw?: string | null,
): NormalizedGatewayStatus | null {
  if (!raw) return null;
  const key = raw.trim().toUpperCase();
  return RAW_TO_INTERNAL[key] || null;
}

export function deriveStateCode(internal: BookingPaymentStatus): string {
  switch (internal) {
    case "paid":
      return "READY";
    case "awaiting_payment":
      return "WAITING_PAYMENT";
    case "failed":
      return "FAILED";
    case "expired":
      return "EXPIRED";
    case "refunded":
      return "REFUNDED";
    default:
      return "PENDING";
  }
}
