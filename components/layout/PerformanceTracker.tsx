"use client";

import { useEffect } from "react";
import { trackWebVitals } from "@/lib/performance";

/**
 * Client component that initializes performance tracking on mount
 * Tracks Core Web Vitals (LCP, FID, CLS, TTFB) and sends to analytics API
 */
export function PerformanceTracker() {
  useEffect(() => {
    // Initialize performance tracking once on mount
    trackWebVitals();
  }, []);

  // This component renders nothing
  return null;
}
