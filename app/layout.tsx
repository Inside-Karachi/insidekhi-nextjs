import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { UnifiedPremiumHeader } from "@/components/layout/UnifiedPremiumHeader";
import { Footer } from "@/components/layout/Footer";
import { createServerSupabase } from "@/lib/supabase/server";
import { ScrollProvider } from "@/lib/context/scroll-context";
import { RoleProvider } from "@/lib/context/RoleContext";
import { Toaster } from "@/components/ui/toaster";
import { ConditionalLayout } from "@/components/layout/ConditionalLayout";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import RouteProgress from "@/components/layout/RouteProgress";
import { PerformanceTracker } from "@/components/layout/PerformanceTracker";
import { unstable_cache } from "next/cache";
import { Suspense } from "react";

// Cache categories for footer - revalidate every hour
// This allows child pages to use their own ISR caching
const getCachedCategories = unstable_cache(
  async () => {
    try {
      const supabase = await createServerSupabase();
      const { data, error } = await supabase
        .from("categories")
        .select("name, slug")
        .is("parent_id", null)
        .order("name", { ascending: true });
      if (!error && Array.isArray(data)) {
        return data.filter((c) => c && c.name && c.slug);
      }
    } catch (_err) {
      // Fail silently
    }
    return [];
  },
  ["footer-categories"],
  { revalidate: 3600, tags: ["categories"] },
);

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap", // Prevents invisible text during font load
  preload: true, // Preloads font for better performance
  fallback: [
    "system-ui",
    "-apple-system",
    "BlinkMacSystemFont",
    "Segoe UI",
    "Roboto",
    "sans-serif",
  ],
});

export const metadata: Metadata = {
  title: "Inside Karachi - Your City Guide",
  description: "Discover the best of Karachi, from restaurants to events.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Use cached categories for footer - allows child pages to use ISR
  const serverCategories = await getCachedCategories();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Load reCAPTCHA only when needed - moved to individual components */}
        {/* <script
          src={`https://www.google.com/recaptcha/api.js?render=${process.env.NEXT_PUBLIC_RECAPTCHA_V3_SITE_KEY}`}
          async
        /> */}
      </head>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased",
          inter.variable,
        )}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <RoleProvider>
            <ScrollProvider>
              <ConditionalLayout
                header={
                  <UnifiedPremiumHeader
                    context="public"
                    showDiscoveryPanel={true}
                  />
                }
                footer={<Footer serverCategories={serverCategories} />}
              >
                {/* Route change loader bar - wrapped in Suspense for useSearchParams */}
                <Suspense fallback={null}>
                  <RouteProgress />
                </Suspense>
                {/* Performance monitoring */}
                <PerformanceTracker />
                {children}
                <Analytics />
                <SpeedInsights />
              </ConditionalLayout>
              <Toaster />
            </ScrollProvider>
          </RoleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
