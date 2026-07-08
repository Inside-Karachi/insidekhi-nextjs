/**
 * PayFast Failure Callback Page
 *
 * This page handles failed payment redirects from PayFast.
 * It validates the callback parameters and displays appropriate error messages.
 */

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { validatePayFastCallback } from "@/lib/payments/payfast";
import { CheckoutFailedContent } from "@/components/checkout/CheckoutFailedContent";

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

async function FailureContent({ searchParams }: PageProps) {
  const params = await searchParams;

  // Extract callback parameters
  const basketId = typeof params.basket_id === "string" ? params.basket_id : "";
  const errCode = typeof params.err_code === "string" ? params.err_code : "";
  const errMsg = typeof params.err_msg === "string" ? params.err_msg : "";
  const transactionId =
    typeof params.transaction_id === "string" ? params.transaction_id : "";

  // Dev preview mode: ?preview=failed|security_failed renders the UI without PayFast validation.
  const previewMode =
    typeof params.preview === "string" ? params.preview : null;

  if (
    previewMode &&
    process.env.NODE_ENV === "development" &&
    ["failed", "security_failed"].includes(previewMode)
  ) {
    console.log(`[Checkout Failed] PREVIEW MODE: ${previewMode}`);
    return (
      <CheckoutFailedContent
        status={previewMode as "failed" | "security_failed"}
        basketId={basketId || "PREVIEW-BASKET-123"}
        transactionId={transactionId || "PREVIEW-TXN-456"}
        errCode={errCode || "51"}
        errMsg={
          errMsg || "Insufficient funds - Please try a different payment method"
        }
      />
    );
  }
  // ============================================================================

  // Validate callback
  let validationResult = null;
  let isValid = false;

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
  } catch (error) {
    console.error("[PayFast Failure] Validation error:", error);
  }

  // Map common error codes to user-friendly messages
  const getErrorMessage = (code: string): string => {
    const errorMessages: Record<string, string> = {
      "01": "Card declined by issuer",
      "05": "Do not honor - Please contact your bank",
      "12": "Invalid transaction",
      "13": "Invalid amount",
      "14": "Invalid card number",
      "30": "Format error",
      "41": "Lost card - Please contact your bank",
      "43": "Stolen card - Please contact your bank",
      "51": "Insufficient funds",
      "54": "Expired card",
      "55": "Incorrect PIN",
      "57": "Transaction not permitted to cardholder",
      "58": "Transaction not permitted on terminal",
      "61": "Exceeds withdrawal limit",
      "62": "Restricted card",
      "63": "Security violation",
      "65": "Exceeds withdrawal frequency limit",
      "75": "PIN tries exceeded",
      "91": "Issuer or switch inoperative",
      "96": "System malfunction",
    };

    return errorMessages[code] || "Payment could not be processed";
  };

  // Show security warning if hash validation failed
  if (!isValid && basketId) {
    return (
      <CheckoutFailedContent
        status="security_failed"
        basketId={basketId}
        transactionId={transactionId}
        errCode={errCode}
        errMsg={errMsg}
      />
    );
  }

  // Show payment failure
  const friendlyMessage = errMsg || getErrorMessage(errCode);

  return (
    <CheckoutFailedContent
      status="failed"
      basketId={basketId}
      transactionId={transactionId}
      errCode={errCode}
      errMsg={friendlyMessage}
    />
  );
}

export default function PayFastFailurePage(props: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <FailureContent {...props} />
    </Suspense>
  );
}
