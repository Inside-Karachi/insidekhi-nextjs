"use client";

import * as React from "react";
import { ListingModal } from "@/components/admin/ListingModal";
import { useToast } from "@/hooks/use-toast";
import { buildBusinessOwnerCreatePayload } from "@/lib/business-owner/listing-modal-utils";
import type { Listing } from "@/types/listing.types";

interface BusinessOwnerListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BusinessOwnerListingModal({
  isOpen,
  onClose,
  onSuccess,
}: BusinessOwnerListingModalProps) {
  const { toast } = useToast();

  const handleSave = React.useCallback(
    async (listingData: Partial<Listing>) => {
      try {
        const payload = buildBusinessOwnerCreatePayload(listingData);
        const response = await fetch("/api/business/listings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to create listing");
        }

        // Create flow uses shared temp image pipeline in ListingModal,
        // so we normalize return shape for post-save image move.
        const createdListing = {
          ...(result.data || {}),
          id: result.data?.id,
          status: "draft",
        } as Listing;

        toast({
          title: "Listing created",
          description:
            "Draft listing saved successfully. Submit for approval when ready.",
        });

        onSuccess();
        onClose();
        return createdListing;
      } catch (error) {
        toast({
          title: "Error",
          description:
            error instanceof Error
              ? error.message
              : "Failed to create listing",
          variant: "destructive",
        });
        return null;
      }
    },
    [onClose, onSuccess, toast],
  );

  return (
    <ListingModal
      listing={null}
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      hideAdminFields={true}
    />
  );
}
