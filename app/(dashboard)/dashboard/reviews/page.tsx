"use client";

import React from "react";
import { useRouter } from "next/navigation";

import { PremiumReviewsGrid } from "@/components/dashboard/PremiumReviewsGrid";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { useReviewsRealtime } from "@/lib/context/reviewsStore";

export default function ReviewsPage() {
  const router = useRouter();
  const { userId, isLoading, error } = useSupabaseUser();

  useReviewsRealtime(userId);

  React.useEffect(() => {
    // Do not redirect a signed-in user to login merely because `/api/user/me`
    // had a transient network/database failure. A genuine missing session has
    // no hook error and still follows the normal login redirect.
    if (!isLoading && !userId && !error) {
      router.replace("/login?returnUrl=/dashboard/reviews");
    }
  }, [isLoading, userId, error, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">
          {error
            ? "We could not verify your session. Please refresh and try again."
            : "Loading..."}
        </div>
      </div>
    );
  }

  return <PremiumReviewsGrid />;
}
