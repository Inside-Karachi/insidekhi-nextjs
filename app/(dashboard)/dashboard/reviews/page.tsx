"use client";

import React from "react";
import { useRouter } from "next/navigation";

import { PremiumReviewsGrid } from "@/components/dashboard/PremiumReviewsGrid";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { useReviewsRealtime } from "@/lib/context/reviewsStore";

export default function ReviewsPage() {
  const router = useRouter();
  const { userId, isLoading } = useSupabaseUser();

  useReviewsRealtime(userId);

  React.useEffect(() => {
    if (!isLoading && !userId) {
      router.replace("/login?returnUrl=/dashboard/reviews");
    }
  }, [isLoading, userId, router]);

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
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return <PremiumReviewsGrid />;
}
