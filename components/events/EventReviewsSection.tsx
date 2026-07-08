"use client";

import { motion } from "framer-motion";
import { PaginatedReviews } from "@/components/listing/PaginatedReviews";
import { PremiumHeading } from "@/components/brand/Typography";
import {
  sectionVariants,
  viewportSettings,
} from "@/lib/utils/listing-animations";

// Local interface for event reviews (doesn't require branch_id)
interface Review {
  id: number;
  user_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  branch_id?: number; // Optional for events
  helpful_count?: number | null;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface EventReviewsSectionProps {
  reviews: Review[];
  listingId: number;
}

export function EventReviewsSection({
  reviews,
  listingId,
}: EventReviewsSectionProps) {
  return (
    <motion.div
      className="space-y-6 md:space-y-8"
      initial="hidden"
      whileInView="visible"
      viewport={viewportSettings}
      variants={sectionVariants}
    >
      <div className="space-y-4">
        <PremiumHeading level={2} dense className="text-foreground">
          Venue <span className="gradient-text-primary">Reviews</span>
        </PremiumHeading>
        <p className="text-sm sm:text-base md:text-lg text-muted-foreground md:mt-1">
          See what people are saying about the venue hosting this event.
        </p>
      </div>

      <PaginatedReviews reviews={reviews} listingId={listingId} />
    </motion.div>
  );
}
