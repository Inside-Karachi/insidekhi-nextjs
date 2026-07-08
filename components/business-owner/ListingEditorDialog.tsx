"use client";

import * as React from "react";
import { ListingModal } from "@/components/admin/ListingModal";
import { useToast } from "@/hooks/use-toast";
import { buildBusinessOwnerUpdatePayload } from "@/lib/business-owner/listing-modal-utils";
import type { Listing } from "@/types/listing.types";

interface ListingEditorDialogProps {
  listingId: number;
  onClose: () => void;
}

export function ListingEditorDialog({
  listingId,
  onClose,
}: ListingEditorDialogProps) {
  const [listing, setListing] = React.useState<Listing | null>(null);
  const [loading, setLoading] = React.useState(true);
  const { toast } = useToast();

  React.useEffect(() => {
    const fetchListing = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/business/listings/${listingId}`);
        const result = await response.json();

        if (result.success) {
          setListing(result.data);
        } else {
          toast({
            title: "Error",
            description: "Failed to load listing",
            variant: "destructive",
          });
          onClose();
        }
      } catch (error) {
        console.error("Error fetching listing:", error);
        toast({
          title: "Error",
          description: "Failed to load listing",
          variant: "destructive",
        });
        onClose();
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [listingId, onClose, toast]);

  const handleSave = React.useCallback(
    async (listingData: Partial<Listing>) => {
      try {
        const payload = buildBusinessOwnerUpdatePayload(listingData);
        const response = await fetch(`/api/business/listings/${listingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || "Failed to save listing");
        }

        if (result.data?.change_request_created) {
          toast({
            title: "Change request submitted",
            description:
              "Major changes were sent for admin review and approval.",
          });
          onClose();
          return listing;
        }

        const updatedListing = (result.data || null) as Listing | null;
        if (updatedListing) {
          setListing(updatedListing);
        }

        toast({
          title: "Listing updated",
          description: result.message || "Changes saved successfully.",
        });

        onClose();
        return updatedListing;
      } catch (error) {
        toast({
          title: "Error",
          description:
            error instanceof Error ? error.message : "Failed to save listing",
          variant: "destructive",
        });
        return null;
      }
    },
    [listing, listingId, onClose, toast],
  );

  if (loading) {
    return null;
  }

  if (!listing) {
    return null;
  }

  return (
    <ListingModal
      listing={listing}
      isOpen={true}
      onClose={onClose}
      onSave={handleSave}
      hideAdminFields={true}
    />
  );
}
