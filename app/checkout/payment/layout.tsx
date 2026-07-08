import { Suspense } from "react";

// Payment pages use useSearchParams - need Suspense boundary
export default function PaymentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Return children directly without header/footer for app-like checkout experience
  // Wrap in Suspense for useSearchParams support
  return <Suspense fallback={null}>{children}</Suspense>;
}
