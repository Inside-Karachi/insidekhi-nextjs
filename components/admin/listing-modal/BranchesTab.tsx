"use client";

import * as React from "react";
import { TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, AlertCircle, MapPin } from "lucide-react";
import {
  BranchWithHours,
  BranchFormData,
  OpeningHour,
} from "@/types/listing.types";
import { BranchCard } from "./BranchCard";
import { BranchForm } from "./BranchForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";

interface BranchesTabProps {
  listingId: number | null;
  branches: BranchWithHours[];
  isLoading: boolean;
  onUpdate: () => void;
}

export function BranchesTab({
  listingId,
  branches,
  isLoading,
  onUpdate,
}: BranchesTabProps) {
  const [isSaving, setIsSaving] = React.useState(false);
  const [showForm, setShowForm] = React.useState(false);
  const [selectedBranch, setSelectedBranch] =
    React.useState<BranchWithHours | null>(null);
  const { toast } = useToast();

  // Fetch branches logic removed - lifted to parent listing-modal

  const handleAddBranch = () => {
    setSelectedBranch(null);
    setShowForm(true);
  };

  const handleEditBranch = (branch: BranchWithHours) => {
    setSelectedBranch(branch);
    setShowForm(true);
  };

  const handleSaveBranch = async (
    data: BranchFormData,
    hours?: OpeningHour[]
  ) => {
    if (!listingId) {
      toast({
        title: "Error",
        description: "Please save the listing first before adding branches.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Save or update branch
      const isEditing = !!data.id;
      const url = `/api/admin/listings/${listingId}/branches`;
      const method = isEditing ? "PATCH" : "POST";
      const body = isEditing ? { branch_id: data.id, ...data } : data;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to save branch");
      }

      // Save opening hours if provided
      if (hours && hours.length > 0 && result.branch) {
        try {
          await fetch(`/api/admin/listings/${listingId}/opening-hours`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              opening_hours: hours.map((h) => ({
                ...h,
                listing_id: listingId,
                branch_id: result.branch.id,
              })),
            }),
          });
        } catch (err) {
          console.error("Error saving opening hours:", err);
          toast({
            title: "Warning",
            description: "Branch saved but opening hours failed to save.",
            variant: "destructive",
          });
        }
      }

      toast({
        title: "Success",
        description: isEditing
          ? "Branch updated successfully"
          : "Branch added successfully",
      });

      setShowForm(false);
      setSelectedBranch(null);
      // fetchBranches(); // Handled by onUpdate
      onUpdate();
    } catch (error) {
      console.error("Error saving branch:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save branch",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBranch = async (branchId: number) => {
    if (!listingId) return;

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/admin/listings/${listingId}/branches`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ branch_id: branchId }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete branch");
      }

      toast({
        title: "Success",
        description: "Branch deleted successfully",
      });

      // fetchBranches(); // Handled by onUpdate
      onUpdate();
    } catch (error) {
      console.error("Error deleting branch:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to delete branch",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <TabsContent value="branches" className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Branch Locations</h3>
          <p className="text-sm text-muted-foreground">
            Manage multiple locations for this listing
          </p>
        </div>
        <Button onClick={handleAddBranch} disabled={!listingId || isLoading}>
          <Plus className="h-4 w-4 mr-2" />
          Add Branch
        </Button>
      </div>

      {/* Info Alert for new listings */}
      {!listingId && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Please save the listing first before adding branch locations.
          </AlertDescription>
        </Alert>
      )}

      {/* Branch List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Loading branches...</p>
          </div>
        </div>
      ) : branches.length > 0 ? (
        <div className="space-y-4">
          {branches.map((branch) => (
            <BranchCard
              key={branch.id}
              branch={branch}
              onEdit={handleEditBranch}
              onDelete={handleDeleteBranch}
              isDeleting={isSaving}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-6 mb-4">
            <MapPin className="h-10 w-10 text-muted-foreground" />
          </div>
          <h4 className="text-lg font-semibold mb-2">No Branches Yet</h4>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            Add branch locations to help customers find your business across
            different areas
          </p>
          {listingId && (
            <Button onClick={handleAddBranch} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add First Branch
            </Button>
          )}
        </div>
      )}

      {/* Branch Form Dialog */}
      <BranchForm
        isOpen={showForm}
        onClose={() => {
          setShowForm(false);
          setSelectedBranch(null);
        }}
        onSave={handleSaveBranch}
        branch={selectedBranch}
        isLoading={isSaving}
      />
    </TabsContent>
  );
}
