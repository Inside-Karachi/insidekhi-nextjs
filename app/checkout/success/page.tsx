/**
 * PayFast Success Callback Page
 *
 * This page handles successful payment redirects from PayFast.
 * It validates the callback parameters and updates the booking status via API.
 */

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import {
  validatePayFastCallback,
  normalizePayFastStatus,
} from "@/lib/payments/payfast";
import { CheckoutSuccessContent } from "@/components/checkout/CheckoutSuccessContent";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function SuccessContent({ searchParams }: PageProps) {
  const params = await searchParams;

  // Extract callback parameters
  const basketId = typeof params.basket_id === "string" ? params.basket_id : "";
  const errCode = typeof params.err_code === "string" ? params.err_code : "";
  const errMsg = typeof params.err_msg === "string" ? params.err_msg : "";
  const transactionId =
    typeof params.transaction_id === "string" ? params.transaction_id : "";

  // Dev preview mode: ?preview=paid|pending|security_failed renders the UI without PayFast validation.
  const previewMode =
    typeof params.preview === "string" ? params.preview : null;

  if (
    previewMode &&
    process.env.NODE_ENV === "development" &&
    ["paid", "pending", "security_failed"].includes(previewMode)
  ) {
    console.log(`[Checkout Success] PREVIEW MODE: ${previewMode}`);
    return (
      <CheckoutSuccessContent
        status={previewMode as "paid" | "pending" | "security_failed"}
        basketId={basketId || "PREVIEW-BASKET-123"}
        transactionId={transactionId || "PREVIEW-TXN-456"}
        errCode={errCode || "N/A"}
        errMsg={errMsg}
      />
    );
  }
  // ============================================================================

  // Validate callback
  let validationResult = null;
  let isValid = false;
  let normalizedStatus: "paid" | "failed" | "pending" = "pending";

  try {
    validationResult = validatePayFastCallback({
      basket_id: basketId,
      err_code: errCode,
      err_msg: errMsg,
      transaction_id: transactionId,
      ...Object.fromEntries(
        Object.entries(params).map(([k, v]) => [
          k,
          typeof v === "string" ? v : "",
        ]),
      ),
    });

    isValid = validationResult.isValid;
    normalizedStatus = normalizePayFastStatus(errCode);
  } catch (error) {
    console.error("[PayFast Success] Validation error:", error);
  }

  // Show security warning if hash validation failed
  if (!isValid) {
    return (
      <CheckoutSuccessContent
        status="security_failed"
        basketId={basketId}
        transactionId={transactionId}
        errCode={errCode}
        errMsg={errMsg}
      />
    );
  }

  // Determine status for the component (only paid/pending on success URL)
  const status: "paid" | "pending" =
    normalizedStatus === "paid" ? "paid" : "pending";

  return (
    <CheckoutSuccessContent
      status={status}
      basketId={basketId}
      transactionId={transactionId}
      errCode={errCode}
      errMsg={errMsg}
    />
  );
}

export default function PayFastSuccessPage(props: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <SuccessContent {...props} />
    </Suspense>
  );
}
