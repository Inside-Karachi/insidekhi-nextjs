"use client";

import { useEffect, useState } from "react";
import { OpeningHours } from "@/components/listing/OpeningHours";
import { useBranchSelection } from "@/lib/context/BranchSelectionContext";
import { OpeningHoursSkeleton } from "@/components/listing/skeletons";

interface OpeningHoursContainerProps {
  listingId: number;
}

interface OpeningHour {
  id: number;
  listing_id: number;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean | null;
  branch_id: number | null;
}

export function OpeningHoursContainer({
  listingId,
}: OpeningHoursContainerProps) {
  const { selectedBranchId } = useBranchSelection();
  const [openingHours, setOpeningHours] = useState<OpeningHour[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchOpeningHours() {
      setIsLoading(true);

      // Fetch opening hours - filter by branch if one is selected.
      // If a branch is selected, show branch-specific hours; otherwise show
      // listing-level hours (branch_id IS NULL) via the API route.
      const url = selectedBranchId
        ? `/api/listings/${listingId}/opening-hours?branch_id=${selectedBranchId}`
        : `/api/listings/${listingId}/opening-hours`;

      try {
        const res = await fetch(url);
        const json = await res.json();
        setOpeningHours(json?.data || []);
      } catch {
        setOpeningHours([]);
      }

      setIsLoading(false);
    }

    fetchOpeningHours();
  }, [listingId, selectedBranchId]);

  if (isLoading) {
    return <OpeningHoursSkeleton />;
  }

  if (!openingHours || openingHours.length === 0) {
    return null;
  }

  return (
    <div id="opening-hours-section">
      <OpeningHours openingHours={openingHours} />
    </div>
  );
}
