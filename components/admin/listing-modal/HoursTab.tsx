"use client";

import * as React from "react";
import { TabsContent } from "@/components/ui/tabs";
import { OpeningHoursEditor } from "../../listing/OpeningHoursEditor";
import { OpeningHour, BranchWithHours } from "@/types/listing.types";
import { MapPin } from "lucide-react";

interface HoursTabProps {
  openingHours: OpeningHour[];
  onChange: (hours: OpeningHour[]) => void;
  isLoading: boolean;
  branches?: BranchWithHours[];
}

export function HoursTab({
  openingHours,
  onChange,
  isLoading,
  branches,
}: HoursTabProps) {
  const hasPrimaryBranch = branches?.some((b) => b.is_primary);
  const primaryBranch = branches?.find((b) => b.is_primary);

  return (
    <TabsContent value="hours" className="space-y-8">
      <div className="py-4">
        <OpeningHoursEditor
          value={openingHours}
          onChange={onChange}
          disabled={isLoading || !!hasPrimaryBranch}
          customAction={
            hasPrimaryBranch && (
              <div className="flex items-center gap-2 bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                <span>Managed by Primary Branch</span>
              </div>
            )
          }
          description={
            hasPrimaryBranch &&
            primaryBranch && (
              <p>
                Opening hours are synced with:{" "}
                <strong>{primaryBranch.name}</strong>
              </p>
            )
          }
        />
      </div>
    </TabsContent>
  );
}
