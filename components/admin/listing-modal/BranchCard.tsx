"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Edit, Trash2, Star, CheckCircle2 } from "lucide-react";
import { BranchWithHours } from "@/types/listing.types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BranchCardProps {
  branch: BranchWithHours;
  onEdit: (branch: BranchWithHours) => void;
  onDelete: (branchId: number) => void;
  isDeleting?: boolean;
}

export function BranchCard({
  branch,
  onEdit,
  onDelete,
  isDeleting = false,
}: BranchCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);

  const handleDelete = () => {
    onDelete(branch.id);
    setShowDeleteDialog(false);
  };

  return (
    <>
      <Card className="p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-4">
          {/* Branch Info */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Header with Name and Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-semibold text-foreground truncate">
                {branch.name}
              </h3>
              {branch.is_primary && (
                <Badge className="bg-primary text-primary-foreground flex-shrink-0">
                  <Star className="h-3 w-3 mr-1" />
                  Primary
                </Badge>
              )}
              {branch.is_verified && (
                <Badge
                  variant="outline"
                  className="text-green-600 border-green-600 flex-shrink-0"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              )}
            </div>

            {/* Address */}
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p className="line-clamp-2">{branch.address}</p>
            </div>

            {/* Location Details */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                {branch.city}, {branch.country}
              </span>
              {branch.latitude && branch.longitude && (
                <span className="text-xs">
                  {branch.latitude.toFixed(6)}, {branch.longitude.toFixed(6)}
                </span>
              )}
            </div>

            {/* Phone Number */}
            {branch.phone_number && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a
                  href={`tel:${branch.phone_number}`}
                  className="text-primary hover:underline"
                >
                  {branch.phone_number}
                </a>
              </div>
            )}

            {/* Opening Hours Summary */}
            {branch.opening_hours && branch.opening_hours.length > 0 && (
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">Hours:</span>{" "}
                {branch.opening_hours.some((h) => !h.isClosed) ? (
                  <span className="text-green-600">Has operating hours</span>
                ) : (
                  <span className="text-amber-600">No hours set</span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(branch)}
              className="w-20"
            >
              <Edit className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDeleting}
              className="w-20 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          </div>
        </div>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Branch?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{branch.name}</strong>?
              This will also remove all associated opening hours. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete Branch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
