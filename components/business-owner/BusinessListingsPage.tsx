"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { User } from "@supabase/supabase-js";
import type { BusinessOwnerListing } from "@/types/business-owner.types";
import {
  Store,
  Search,
  Filter,
  Eye,
  Star,
  TrendingUp,
  AlertCircle,
  ExternalLink,
  Plus,
  Edit,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBusinessListings } from "@/hooks/useBusinessListings";
import { BusinessOwnerListingModal } from "./BusinessOwnerListingModal";
import { ListingEditorDialog } from "./ListingEditorDialog";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";
import { getListingStatusLabel } from "@/lib/listings/status-display";
import { cn } from "@/lib/utils";
import {
  BusinessOwnerPageHeader,
  BUSINESS_OWNER_CARD_SURFACE,
  BUSINESS_OWNER_EMPTY_STATE,
  BUSINESS_OWNER_FILTER_BAR,
} from "./BusinessOwnerPageHeader";

interface BusinessListingsPageProps {
  user: User;
  profile: {
    full_name?: string | null;
    role?: string;
  } | null;
}

export function BusinessListingsPage({
  user: _user,
  profile: _profile,
}: BusinessListingsPageProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [page, setPage] = React.useState(1);
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [editingListingId, setEditingListingId] = React.useState<number | null>(null);
  const [submittingId, setSubmittingId] = React.useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [listingToDelete, setListingToDelete] = React.useState<BusinessOwnerListing | null>(null);
  const [deleteReason, setDeleteReason] = React.useState("");
  const [deletingListingId, setDeletingListingId] = React.useState<number | null>(null);
  const { listings, loading, error, pagination, refetch } = useBusinessListings({
    status: statusFilter,
    page,
    limit: 20,
  });
  const { toast } = useToast();

  // Reset to first page whenever the status filter changes
  React.useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  // Filter listings based on search (status is handled server-side)
  const filteredListings = React.useMemo(() => {
    return listings.filter((listing) => {
      return (
        searchQuery === "" ||
        listing.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  }, [listings, searchQuery]);

  const handleSubmitForApproval = async (listingId: number) => {
    try {
      setSubmittingId(listingId);
      const response = await fetch(`/api/business/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submit_for_approval: true }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: "Listing submitted for approval",
        });
        refetch();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to submit listing",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error submitting listing:", error);
      toast({
        title: "Error",
        description: "Failed to submit listing for approval",
        variant: "destructive",
      });
    } finally {
      setSubmittingId(null);
    }
  };

  const openDeleteRequestDialog = (listing: BusinessOwnerListing) => {
    setListingToDelete(listing);
    setDeleteReason("");
    setDeleteDialogOpen(true);
  };

  const handleRequestDelete = async () => {
    if (!listingToDelete) return;
    if (!deleteReason.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a reason for deletion request",
        variant: "destructive",
      });
      return;
    }

    try {
      setDeletingListingId(listingToDelete.id);
      const response = await fetch(`/api/business/listings/${listingToDelete.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deleteReason.trim() }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Deletion request submitted",
          description: "Your request has been sent for admin approval.",
        });
        setDeleteDialogOpen(false);
        setListingToDelete(null);
        setDeleteReason("");
        refetch();
      } else {
        toast({
          title: "Unable to request deletion",
          description: result.error || "Failed to submit deletion request",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error requesting listing deletion:", error);
      toast({
        title: "Error",
        description: "Failed to submit deletion request",
        variant: "destructive",
      });
    } finally {
      setDeletingListingId(null);
    }
  };

  return (
    <div className="w-full">
      <BusinessOwnerPageHeader
        icon={Store}
        title="My Listings"
        description="View and manage all your business listings"
        action={
          <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create listing</span>
            <span className="sm:hidden">Create</span>
          </Button>
        }
      />

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className={cn(
          "flex flex-col sm:flex-row gap-4 mb-8",
          BUSINESS_OWNER_FILTER_BAR,
        )}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search listings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending_approval">Under Review</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => refetch()}>
          Refresh
        </Button>
      </motion.div>

      {/* Listings Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className={cn("p-6", BUSINESS_OWNER_CARD_SURFACE)}>
              <Skeleton className="h-32 w-full" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <div className={BUSINESS_OWNER_EMPTY_STATE}>
          <div className="p-4 rounded-full bg-destructive/10 w-fit mx-auto mb-6">
            <AlertCircle className="h-12 w-12 text-destructive" />
          </div>
          <h3 className="text-2xl font-semibold text-foreground mb-3">
            Couldn&apos;t load listings
          </h3>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">{error}</p>
          <Button variant="outline" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      ) : filteredListings.length === 0 ? (
        <div className={BUSINESS_OWNER_EMPTY_STATE}>
          <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto mb-6">
            <AlertCircle className="h-12 w-12 text-primary" />
          </div>
          <h3 className="text-2xl font-semibold text-foreground mb-3">
            {searchQuery || statusFilter !== "all"
              ? "No listings match"
              : "No listings yet"}
          </h3>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            {searchQuery || statusFilter !== "all"
              ? "Try adjusting your search or filters, or clear them to see everything."
              : "Create a listing to reach customers on Inside Karachi."}
          </p>
          {searchQuery || statusFilter !== "all" ? (
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setPage(1);
              }}
            >
              Clear filters
            </Button>
          ) : (
            <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create your first listing
            </Button>
          )}
        </div>
      ) : (
        <>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredListings.map((listing, index) => (
            <motion.div
              key={listing.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card
                className={cn("p-6 group", BUSINESS_OWNER_CARD_SURFACE)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1 line-clamp-1 group-hover:text-primary transition-colors">
                      {listing.name}
                    </h3>
                    <Badge
                      variant={
                        listing.status === "published"
                          ? "default"
                          : listing.status === "draft"
                            ? "secondary"
                            : listing.status === "pending_approval"
                              ? "outline"
                              : "destructive"
                      }
                      className="text-xs"
                    >
                      {getListingStatusLabel(listing.status)}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Eye className="h-4 w-4" />
                    <span>{listing.total_views.toLocaleString()} views</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span>
                      {listing.avg_rating.toFixed(1)} ({listing.total_reviews})
                    </span>
                  </div>
                </div>

                {listing.status === "published" && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 mb-4">
                    <TrendingUp className="h-4 w-4" />
                    <span className="font-medium">Live & Discoverable</span>
                  </div>
                )}

                {listing.deletion_request && (
                  <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                      Deletion requested and awaiting admin review
                    </p>
                    {listing.deletion_request.reason && (
                      <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-300/80 line-clamp-2">
                        Reason: {listing.deletion_request.reason}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    size="sm"
                    variant="default"
                    className="flex-1"
                    onClick={() => setEditingListingId(listing.id)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  {listing.status === "draft" && !listing.deletion_request && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSubmitForApproval(listing.id)}
                      disabled={submittingId === listing.id}
                    >
                      <Send className="h-3 w-3 mr-1" />
                      {submittingId === listing.id ? "Submitting..." : "Submit"}
                    </Button>
                  )}
                  {listing.status !== "archived" &&
                    listing.status !== "pending_approval" &&
                    !listing.deletion_request && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => openDeleteRequestDialog(listing)}
                        disabled={deletingListingId === listing.id}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    )}
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={`/listing/${listing.slug}`}
                      target="_blank"
                      className="gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View
                    </Link>
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {pagination && pagination.total_pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              disabled={!pagination.has_prev || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.total_pages}
              {typeof pagination.total === "number"
                ? ` (${pagination.total} total)`
                : ""}
            </span>
            <Button
              variant="outline"
              disabled={!pagination.has_next || loading}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </Button>
          </div>
        )}
        </>
      )}

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Listing Deletion</DialogTitle>
            <DialogDescription>
              This will send your deletion request for admin approval. The listing
              stays visible until approved.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="delete-reason">
              Reason <span className="text-destructive">*</span>
            </label>
            <Textarea
              id="delete-reason"
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="Why do you want to delete this listing?"
              rows={4}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deletingListingId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRequestDelete}
              disabled={deletingListingId !== null}
            >
              {deletingListingId !== null
                ? "Submitting Request..."
                : "Submit Deletion Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Listing Modal */}
      <BusinessOwnerListingModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={refetch}
      />

      {/* Edit Listing Modal */}
      {editingListingId && (
        <ListingEditorDialog
          listingId={editingListingId}
          onClose={() => {
            setEditingListingId(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
