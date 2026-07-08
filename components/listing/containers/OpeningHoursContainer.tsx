"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
      const supabase = createClient();

      // Fetch opening hours - filter by branch if one is selected
      const query = supabase
        .from("opening_hours")
        .select("*")
        .eq("listing_id", listingId)
        .order("day_of_week", { ascending: true });

      // If a branch is selected, show branch-specific hours
      // Otherwise, show listing-level hours (branch_id IS NULL)
      if (selectedBranchId) {
        query.eq("branch_id", selectedBranchId);
      } else {
        query.is("branch_id", null);
      }

      const { data } = await query;

      setOpeningHours(data || []);
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
