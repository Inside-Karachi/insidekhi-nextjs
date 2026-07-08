"use client";

import * as React from "react";
import { TabsContent } from "@/components/ui/tabs";
import { ListingGalleryUpload } from "../ListingGalleryUpload";
import { ListingImage } from "@/types/listing.types";

interface GalleryTabProps {
  listingId: number | null;
  tempSessionId?: string;
  images: ListingImage[];
  onImagesChange: (
    images: ListingImage[] | ((prevImages: ListingImage[]) => ListingImage[])
  ) => void;
  isLoading: boolean;
  /** IDs of images marked for deletion (soft delete until Save) */
  pendingDeletions?: Set<number>;
  /** Callback when pending deletions change */
  onPendingDeletionsChange?: (deletions: Set<number>) => void;
}

export function GalleryTab({
  listingId,
  tempSessionId,
  images,
  onImagesChange,
  isLoading,
  pendingDeletions,
  onPendingDeletionsChange,
}: GalleryTabProps) {
  return (
    <TabsContent value="gallery" className="space-y-8">
      <ListingGalleryUpload
        listingId={listingId}
        tempSessionId={tempSessionId}
        images={images}
        onImagesChange={onImagesChange}
        isLoading={isLoading}
        pendingDeletions={pendingDeletions}
        onPendingDeletionsChange={onPendingDeletionsChange}
      />
    </TabsContent>
  );
}
