"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Store,
  Eye,
  MapPin,
  Building2,
} from "lucide-react";
import { format } from "date-fns";

type ListingStatus = "draft" | "pending_approval" | "published" | "rejected";

interface Listing {
  id: number;
  name: string;
  slug: string;
  status: ListingStatus;
  address: string;
  created_at: string;
  submitted_at?: string;
  reviewed_at?: string;
  review_notes?: string;
  owner_id: string;
  categories?: { id: number; name: string; icon_name?: string };
  profiles?: { id: string; full_name?: string };
  deletion_request?: {
    id: number;
    change_type: string;
    reason: string | null;
    created_at: string;
  } | null;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface StatsType {
  draftCount: number;
  pendingCount: number;
  publishedCount: number;
  rejectedCount: number;
}

type StatVariant = "blue" | "orange" | "green" | "red";

const statVariantStyles: Record<
  StatVariant,
  {
    card: string;
    title: string;
    value: string;
    iconWrapper: string;
    icon: string;
  }
> = {
  blue: {
    card: "bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-blue-500/5 dark:from-blue-500/10 dark:via-blue-500/5 dark:to-blue-500/0 border-blue-500/30 dark:border-blue-500/20 hover:shadow-xl hover:shadow-blue-500/25 transition-all duration-300 group cursor-pointer",
    title:
      "text-sm font-medium text-blue-900 dark:text-blue-100 group-hover:text-blue-800 dark:group-hover:text-blue-200 transition-colors",
    value:
      "text-2xl font-bold text-blue-700 dark:text-blue-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors",
    iconWrapper:
      "p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors",
    icon: "h-4 w-4 text-blue-600 dark:text-blue-400",
  },
  orange: {
    card: "bg-gradient-to-br from-orange-500/20 via-orange-500/10 to-orange-500/5 dark:from-orange-500/10 dark:via-orange-500/5 dark:to-orange-500/0 border-orange-500/30 dark:border-orange-500/20 hover:shadow-xl hover:shadow-orange-500/25 transition-all duration-300 group cursor-pointer",
    title:
      "text-sm font-medium text-orange-900 dark:text-orange-100 group-hover:text-orange-800 dark:group-hover:text-orange-200 transition-colors",
    value:
      "text-2xl font-bold text-orange-700 dark:text-orange-300 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors",
    iconWrapper:
      "p-2 bg-orange-500/10 rounded-lg group-hover:bg-orange-500/20 transition-colors",
    icon: "h-4 w-4 text-orange-600 dark:text-orange-400",
  },
  green: {
    card: "bg-gradient-to-br from-green-500/20 via-green-500/10 to-green-500/5 dark:from-green-500/10 dark:via-green-500/5 dark:to-green-500/0 border-green-500/30 dark:border-green-500/20 hover:shadow-xl hover:shadow-green-500/25 transition-all duration-300 group cursor-pointer",
    title:
      "text-sm font-medium text-green-900 dark:text-green-100 group-hover:text-green-800 dark:group-hover:text-green-200 transition-colors",
    value:
      "text-2xl font-bold text-green-700 dark:text-green-300 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors",
    iconWrapper:
      "p-2 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors",
    icon: "h-4 w-4 text-green-600 dark:text-green-400",
  },
  red: {
    card: "bg-gradient-to-br from-red-500/20 via-red-500/10 to-red-500/5 dark:from-red-500/10 dark:via-red-500/5 dark:to-red-500/0 border-red-500/30 dark:border-red-500/20 hover:shadow-xl hover:shadow-red-500/25 transition-all duration-300 group cursor-pointer",
    title:
      "text-sm font-medium text-red-900 dark:text-red-100 group-hover:text-red-800 dark:group-hover:text-red-200 transition-colors",
    value:
      "text-2xl font-bold text-red-700 dark:text-red-300 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors",
    iconWrapper:
      "p-2 bg-red-500/10 rounded-lg group-hover:bg-red-500/20 transition-colors",
    icon: "h-4 w-4 text-red-600 dark:text-red-400",
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export function ListingApprovalsPage() {
  const [listings, setListings] = React.useState<Listing[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("pending_approval");
  const [page, setPage] = React.useState(1);
  const [pagination, setPagination] = React.useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  const [stats, setStats] = React.useState<StatsType>({
    draftCount: 0,
    pendingCount: 0,
    publishedCount: 0,
    rejectedCount: 0,
  });

  const [selectedListing, setSelectedListing] = React.useState<Listing | null>(
    null,
  );
  const [reviewDialogOpen, setReviewDialogOpen] = React.useState(false);
  const [reviewAction, setReviewAction] = React.useState<"approve" | "reject">(
    "approve",
  );
  const [reviewNotes, setReviewNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const { toast } = useToast();

  const fetchListings = React.useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        status: statusFilter,
        page: page.toString(),
        limit: "20",
      });

      const response = await fetch(
        `/api/admin/listings/approvals?${params.toString()}`,
      );
      const result = await response.json();

      if (result.success) {
        setListings(result.data.listings);
        setPagination(result.data.pagination);
        setStats({
          draftCount: result.data.draftCount || 0,
          pendingCount: result.data.pendingCount || 0,
          publishedCount: result.data.publishedCount || 0,
          rejectedCount: result.data.rejectedCount || 0,
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to load listing approvals",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching listings:", error);
      toast({
        title: "Error",
        description: "Failed to load listing approvals",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page, toast]);

  React.useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const handleReview = (listing: Listing, action: "approve" | "reject") => {
    setSelectedListing(listing);
    setReviewAction(action);
    setReviewNotes("");
    setReviewDialogOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedListing) return;

    if (reviewAction === "reject" && !reviewNotes.trim()) {
      toast({
        title: "Review notes required",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/listings/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listing_id: selectedListing.id,
          action: reviewAction,
          review_notes: reviewNotes,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: result.data.message,
        });
        setReviewDialogOpen(false);
        fetchListings();
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error submitting review:", error);
      toast({
        title: "Error",
        description: "Failed to process review",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredListings = React.useMemo(() => {
    if (!searchQuery) return listings;
    return listings.filter((listing) =>
      listing.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [listings, searchQuery]);

  const getStatusBadge = (status: ListingStatus) => {
    const config = {
      draft: { variant: "secondary" as const, label: "Draft", icon: Clock },
      pending_approval: {
        variant: "default" as const,
        label: "Pending",
        icon: AlertCircle,
      },
      published: {
        variant: "default" as const,
        label: "Published",
        icon: CheckCircle2,
      },
      rejected: {
        variant: "destructive" as const,
        label: "Rejected",
        icon: XCircle,
      },
    };

    const { variant, label, icon: Icon } = config[status];
    return (
      <Badge variant={variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Listing Approval Queue
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Review and approve business owner listing submissions. Verify
            listing details, location, and categories before publishing.
          </p>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-2 gap-4 md:grid-cols-4"
      >
        {[
          {
            key: "pending",
            label: "Pending Review",
            value: stats.pendingCount,
            icon: Clock,
            color: "orange" as StatVariant,
          },
          {
            key: "published",
            label: "Published",
            value: stats.publishedCount,
            icon: CheckCircle2,
            color: "green" as StatVariant,
          },
          {
            key: "rejected",
            label: "Rejected",
            value: stats.rejectedCount,
            icon: XCircle,
            color: "red" as StatVariant,
          },
          {
            key: "drafts",
            label: "Drafts",
            value: stats.draftCount,
            icon: Store,
            color: "blue" as StatVariant,
          },
        ].map((card) => {
          const styles = statVariantStyles[card.color];
          const Icon = card.icon;

          return (
            <motion.div
              key={card.key}
              variants={itemVariants}
              whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
            >
              <Card className={styles.card}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className={styles.title}>{card.label}</CardTitle>
                  <div className={styles.iconWrapper}>
                    <Icon className={styles.icon} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={styles.value}>
                    {card.value.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Filters */}
      <motion.div
        variants={itemVariants}
        className="rounded-xl border border-border/50 bg-gradient-to-r from-background/50 to-background/30 p-6 backdrop-blur-sm"
      >
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1 max-w-md">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 rounded-md bg-primary/10 p-1">
                <Search className="h-4 w-4 text-primary" />
              </div>
              <Input
                placeholder="Search by listing name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 bg-background/50 pl-11 pr-4 font-medium placeholder:font-normal border-border/50 focus:border-primary/50"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-11 w-full border-border/50 bg-background/50 md:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending_approval">Pending</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            onClick={fetchListings}
            disabled={loading}
            className="h-11"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Listings Grid */}
      <motion.div variants={itemVariants}>
        {loading ? (
          <div className="grid grid-cols-1 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 bg-muted rounded-lg" />
                    <div className="flex-1 space-y-3">
                      <div className="h-5 bg-muted rounded w-3/4" />
                      <div className="h-4 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredListings.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Queue is Clear!</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {statusFilter === "pending_approval"
                  ? "All listing submissions have been processed. New submissions will appear here."
                  : "No listings match your current filters. Try adjusting your search criteria."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredListings.map((listing) => (
              <motion.div
                key={listing.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 hover:border-primary/50">
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between p-6">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Store className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-lg">
                                {listing.name}
                              </h3>
                              {getStatusBadge(listing.status)}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5" />
                                {listing.address}
                              </div>
                              <div className="flex items-center gap-1.5">
                                Owner:{" "}
                                {listing.profiles?.full_name || "Unknown"}
                              </div>
                            </div>
                          </div>
                        </div>

                        {listing.submitted_at && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground pl-12">
                            <Clock className="h-3 w-3" />
                            <span>
                              Submitted{" "}
                              {format(new Date(listing.submitted_at), "PPp")}
                            </span>
                          </div>
                        )}

                        {listing.deletion_request && (
                          <div className="pl-12 mt-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                            <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1">
                              Pending Deletion Request
                            </p>
                            <p className="text-sm text-amber-800 dark:text-amber-200">
                              {listing.deletion_request.reason ||
                                "No reason provided by owner."}
                            </p>
                          </div>
                        )}

                        {listing.review_notes && (
                          <div className="pl-12 mt-2 p-3 bg-muted/50 rounded-lg">
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Review Notes
                            </p>
                            <p className="text-sm">{listing.review_notes}</p>
                            {listing.reviewed_at && (
                              <p className="text-xs text-muted-foreground mt-1.5">
                                Reviewed{" "}
                                {format(new Date(listing.reviewed_at), "PPp")}
                              </p>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            window.open(`/listing/${listing.slug}`, "_blank")
                          }
                          className="h-9"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {listing.status === "pending_approval" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleReview(listing, "approve")}
                              className="h-9 bg-emerald-600 hover:bg-emerald-700"
                            >
                              <CheckCircle2 className="h-4 w-4 mr-1.5" />
                              {listing.deletion_request
                                ? "Approve Deletion"
                                : "Approve"}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleReview(listing, "reject")}
                              className="h-9"
                            >
                              <XCircle className="h-4 w-4 mr-1.5" />
                              {listing.deletion_request
                                ? "Reject Deletion"
                                : "Reject"}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page - 1)}
              disabled={!pagination.hasPrev}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(page + 1)}
              disabled={!pagination.hasNext}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </motion.div>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approve"
                ? selectedListing?.deletion_request
                  ? "Approve Listing Deletion"
                  : "Approve Listing"
                : selectedListing?.deletion_request
                  ? "Reject Listing Deletion"
                  : "Reject Listing"}
            </DialogTitle>
            <DialogDescription>{selectedListing?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Review Notes{" "}
                {reviewAction === "reject" && (
                  <span className="text-destructive">*</span>
                )}
              </label>
              <Textarea
                placeholder={
                  reviewAction === "approve"
                    ? selectedListing?.deletion_request
                      ? "Optional notes for deletion approval..."
                      : "Optional approval notes..."
                    : selectedListing?.deletion_request
                      ? "Please explain why this deletion request is rejected..."
                      : "Please explain why this listing is being rejected..."
                }
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReviewDialogOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant={reviewAction === "approve" ? "default" : "destructive"}
              onClick={handleSubmitReview}
              disabled={submitting}
            >
              {submitting
                ? "Processing..."
                : reviewAction === "approve"
                  ? "Approve"
                  : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
