// Core Web Vitals + performance monitoring (see trackWebVitals).

// Performance API types
interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

interface FirstInputEntry extends PerformanceEntry {
  processingStart: number;
}

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory: MemoryInfo;
}

export interface PerformanceMetrics {
  lcp: number; // Largest Contentful Paint
  cls: number; // Cumulative Layout Shift
  fid: number; // First Input Delay
  ttfb: number; // Time to First Byte
}

/**
 * Send performance metric to analytics API
 */
async function sendMetricToAPI(
  metricType: "lcp" | "cls" | "fid" | "ttfb",
  value: number,
  page?: string,
) {
  try {
    await fetch("/api/analytics/performance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        metricType,
        value,
        page: page ?? window.location.pathname,
        source: "web",
      }),
      // Fire and forget - don't wait for response
      keepalive: true,
    });
  } catch (error) {
    // Silently fail - don't disrupt user experience
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to send performance metric:", error);
    }
  }
}

/**
 * Track Core Web Vitals and send to analytics API
 * Uses proper metric calculations following Web Vitals standard
 */
export function trackWebVitals() {
  if (typeof window !== "undefined") {
    const currentPage = window.location.pathname;

    // Time to First Byte (TTFB)
    // Should be from requestStart to responseStart
    const navigationEntry = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming;
    if (navigationEntry) {
      const ttfb = navigationEntry.responseStart - navigationEntry.requestStart;
      if (ttfb > 0 && ttfb < 10000) {
        // Sanity check: 0-10 seconds
        sendMetricToAPI("ttfb", ttfb, currentPage);
      }
    }

    // Largest Contentful Paint (LCP)
    // Use renderTime if available, otherwise startTime
    let lcpSent = false;
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as PerformanceEntry & {
        renderTime?: number;
      };
      if (lastEntry && !lcpSent) {
        // LCP is the render time or startTime, whichever is available
        const lcp = lastEntry.renderTime || lastEntry.startTime;
        if (lcp > 0 && lcp < 30000) {
          // Sanity check: 0-30 seconds
          sendMetricToAPI("lcp", lcp, currentPage);
          lcpSent = true;
        }
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });

    // Cumulative Layout Shift (CLS)
    // Sum of all layout shift values without recent input
    let clsValue = 0;
    let clsSent = false;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const layoutEntry = entry as LayoutShiftEntry;
        if (!layoutEntry.hadRecentInput) {
          clsValue += layoutEntry.value;
        }
      }
    }).observe({ type: "layout-shift", buffered: true });

    // Send CLS after 5 seconds of inactivity (page likely stable)
    setTimeout(() => {
      if (clsValue > 0 && !clsSent) {
        sendMetricToAPI("cls", clsValue, currentPage);
        clsSent = true;
      }
    }, 5000);

    // Send CLS on page visibility change (user leaving page)
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.visibilityState === "hidden" && clsValue > 0 && !clsSent) {
          sendMetricToAPI("cls", clsValue, currentPage);
          clsSent = true;
        }
      },
      { once: true },
    );

    // First Input Delay (FID)
    // Time from user interaction to browser response
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const inputEntry = entry as FirstInputEntry;
        const fid = inputEntry.processingStart - entry.startTime;
        if (fid >= 0 && fid < 5000) {
          // Sanity check: 0-5 seconds
          sendMetricToAPI("fid", fid, currentPage);
        }
      }
    }).observe({ type: "first-input", buffered: true });
  }
}

/**
 * Monitor API response times and send to analytics
 * Note: API latency metrics need special handling in the performance API
 */
export function monitorAPIResponse(url: string, startTime: number) {
  const duration = Date.now() - startTime;

  // Send API latency metric (bypassing type check for special metric type)
  fetch("/api/analytics/performance", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      metricType: "api_latency",
      value: duration,
      page: url,
      source: "api",
    }),
    keepalive: true,
  }).catch(() => {
    // Silently fail - don't disrupt user experience
  });

  // Log slow requests in development
  if (process.env.NODE_ENV === "development" && duration > 500) {
    console.warn(`Slow API request: ${url} took ${duration}ms`);
  }
}

/**
 * Monitor component render times
 */
export function measureRenderTime(componentName: string, startTime: number) {
  const duration = Date.now() - startTime;
  console.log(`Component ${componentName} render: ${duration}ms`);

  // Log slow renders (>100ms)
  if (duration > 100) {
    console.warn(`Slow render: ${componentName} took ${duration}ms`);
  }
}

/**
 * Bundle size analyzer (development only)
 */
export function logBundleSize() {
  if (process.env.NODE_ENV === "development") {
    // This would typically integrate with webpack-bundle-analyzer
    console.log(
      "Bundle analysis available at: /_next/static/chunks/bundle-analyzer.html",
    );
  }
}

/**
 * Memory usage monitor
 */
export function monitorMemoryUsage() {
  if (typeof window !== "undefined" && "memory" in performance) {
    const perfWithMemory = performance as PerformanceWithMemory;
    const memInfo = perfWithMemory.memory;
    console.log("Memory Usage:", {
      used: Math.round((memInfo.usedJSHeapSize / 1048576) * 100) / 100 + " MB",
      total:
        Math.round((memInfo.totalJSHeapSize / 1048576) * 100) / 100 + " MB",
      limit:
        Math.round((memInfo.jsHeapSizeLimit / 1048576) * 100) / 100 + " MB",
    });
  }
}
