// Payment related shared TypeScript types (kept separate for organization)
// NOTE: Gateway field names & signature scheme for GoPayFast should be revalidated
// against the latest provider docs once credentials are issued.

export type BookingPaymentStatus =
  | "pending"
  | "awaiting_payment"
  | "paid"
  | "failed"
  | "expired"
  | "refunded";

export type PaymentStage =
  | "awaiting_payment_details"
  | "awaiting_otp"
  | "processing"
  | "completed";

export interface CheckoutSessionResponse {
  booking_id: number;
  booking_reference: string;
  amount: number;
  currency: string;
  gateway: string;
  payment_status: BookingPaymentStatus;
  payment_stage: PaymentStage;
  reused?: boolean;
  mock_mode?: boolean;
  poll_interval_ms?: number;
}

export interface CheckoutTicketItem {
  ticket_type_id: number;
  quantity: number;
}

export interface CheckoutRequestBody {
  event_id: number; // kept for client validation; enforced in RPC by ticket type membership
  tickets: CheckoutTicketItem[];
  customer: {
    name: string;
    email: string;
    phone: string;
    cnic: string; // 13 digit string
  };
}

export interface GoPayFastValidateResponseBody {
  booking_id: number;
  transaction_id: string;
  otp_required: boolean;
  eci?: string;
  status_code?: string;
  status_message?: string;
  code?: string;
  message?: string;
  masked_account?: string;
}

export interface GoPayFastConfirmResponseBody {
  booking_id: number;
  transaction_id: string;
  status_code?: string;
  status_message?: string;
  code?: string;
  message?: string;
  masked_account?: string;
  normalized_status: BookingPaymentStatus;
}

export interface PaymentStatusResponse {
  booking_id: number;
  booking_reference: string;
  payment_status: BookingPaymentStatus;
  passes_issued: boolean;
  pass_count: number;
  normalized_payment_status?: string | null;
  // (Optional) codes for quick UX - e.g. 'READY', 'WAITING_PAYMENT', 'FAILED'
  state_code: string;
}

export interface GoPayFastInitiateArgs {
  bookingId: number;
  bookingReference: string;
  amount: number; // PKR amount
  currency: string; // 'PKR'
  returnUrl?: string;
  callbackUrl?: string;
}

export interface GoPayFastSignatureInput {
  [key: string]: string | number | undefined | null;
}

export interface GoPayFastCallbackPayload {
  merchant_id?: string;
  order_id?: string; // we will send booking_reference
  transaction_id?: string; // provider Tx ID
  amount?: string;
  currency?: string;
  status?: string; // provider raw status
  signature?: string; // provider computed signature for verification
  message?: string; // optional error / status detail
  [extra: string]: unknown; // allow passthrough while staying typesafe-ish
}

export interface NormalizedGatewayStatus {
  raw: string;
  normalized: BookingPaymentStatus;
  final: boolean; // whether no further transitions expected (e.g. paid / failed / refunded)
}
