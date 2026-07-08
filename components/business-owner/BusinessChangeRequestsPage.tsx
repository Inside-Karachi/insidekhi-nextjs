"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User } from "@supabase/supabase-js";
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  FileText,
  Calendar,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import {
  BusinessOwnerPageHeader,
  BUSINESS_OWNER_CARD_SURFACE,
  BUSINESS_OWNER_EMPTY_STATE,
} from "./BusinessOwnerPageHeader";

interface BusinessChangeRequestsPageProps {
  user: User;
  profile: {
    full_name?: string | null;
    role?: string;
  } | null;
}

interface ChangeRequest {
  id: number;
  listing_id: number;
  change_type: string;
  current_data: Record<string, unknown>;
  proposed_data: Record<string, unknown>;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  review_notes: string | null;
  sla_deadline: string | null;
  priority: string | null;
  created_at: string;
  listings?: {
    name: string;
    status: string;
  };
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export function BusinessChangeRequestsPage({
  user: _user,
  profile: _profile,
}: BusinessChangeRequestsPageProps) {
  const { toast } = useToast();
  const [requests, setRequests] = React.useState<ChangeRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedRequest, setSelectedRequest] =
    React.useState<ChangeRequest | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [canceling, setCanceling] = React.useState(false);

  const fetchRequests = React.useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/business/change-requests");
      const result = await response.json();

      if (result.success) {
        setRequests(result.data.requests || []);
      } else {
        throw new Error(result.error || "Failed to fetch change requests");
      }
    } catch (error) {
      console.error("Error fetching change requests:", error);
      toast({
        title: "Error",
        description: "Failed to load change requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleViewDetails = (request: ChangeRequest) => {
    setSelectedRequest(request);
    setDetailsOpen(true);
  };

  const handleCancelRequest = async (requestId: number) => {
    if (!confirm("Are you sure you want to cancel this change request?")) {
      return;
    }

    try {
      setCanceling(true);
      const response = await fetch(
        `/api/business/change-requests/${requestId}`,
        {
          method: "DELETE",
        },
      );

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: "Change request cancelled successfully",
        });
        setDetailsOpen(false);
        fetchRequests();
      } else {
        throw new Error(result.error || "Failed to cancel request");
      }
    } catch (error) {
      console.error("Error cancelling request:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to cancel request",
        variant: "destructive",
      });
    } finally {
      setCanceling(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const configs = {
      pending: {
        variant: "default" as const,
        label: "Pending Review",
        icon: Clock,
        className: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      },
      approved: {
        variant: "default" as const,
        label: "Approved",
        icon: CheckCircle2,
        className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      },
      rejected: {
        variant: "destructive" as const,
        label: "Rejected",
        icon: XCircle,
        className: "bg-red-500/10 text-red-600 border-red-500/20",
      },
    };

    const config = configs[status as keyof typeof configs] || configs.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className={`gap-1.5 ${config.className}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string | null) => {
    if (!priority) return null;

    const configs = {
      urgent: {
        label: "Urgent",
        className: "bg-red-500/10 text-red-600 border-red-500/20",
      },
      high: {
        label: "High",
        className: "bg-orange-500/10 text-orange-600 border-orange-500/20",
      },
      normal: {
        label: "Normal",
        className: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      },
      low: {
        label: "Low",
        className: "bg-gray-500/10 text-gray-600 border-gray-500/20",
      },
    };

    const config = configs[priority as keyof typeof configs];
    if (!config) return null;

    return (
      <Badge variant="outline" className={`text-xs ${config.className}`}>
        {config.label}
      </Badge>
    );
  };

  const formatChangeType = (type: string) => {
    return type
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const renderChangeSummary = (request: ChangeRequest) => {
    const changes: Array<{ field: string; from: unknown; to: unknown }> = [];

    Object.keys(request.proposed_data).forEach((key) => {
      if (request.proposed_data[key] !== request.current_data[key]) {
        changes.push({
          field: key,
          from: request.current_data[key],
          to: request.proposed_data[key],
        });
      }
    });

    if (changes.length === 0) {
      return (
        <span className="text-sm text-muted-foreground">
          No changes detected
        </span>
      );
    }

    return (
      <div className="space-y-2">
        {changes.slice(0, 3).map((change, idx) => (
          <div key={idx} className="text-sm">
            <span className="font-medium text-foreground capitalize">
              {change.field.replace(/_/g, " ")}:
            </span>
            <div className="ml-4 flex items-center gap-2 mt-1">
              <span className="text-muted-foreground line-through">
                {String(change.from || "N/A").substring(0, 50)}
              </span>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-foreground font-medium">
                {String(change.to || "N/A").substring(0, 50)}
              </span>
            </div>
          </div>
        ))}
        {changes.length > 3 && (
          <p className="text-xs text-muted-foreground">
            + {changes.length - 3} more changes
          </p>
        )}
      </div>
    );
  };

  const stats = React.useMemo(() => {
    return {
      pending: requests.filter((r) => r.status === "pending").length,
      approved: requests.filter((r) => r.status === "approved").length,
      rejected: requests.filter((r) => r.status === "rejected").length,
      overdue: requests.filter(
        (r) =>
          r.status === "pending" &&
          r.sla_deadline &&
          isPast(new Date(r.sla_deadline)),
      ).length,
    };
  }, [requests]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="w-full space-y-8"
    >
      <BusinessOwnerPageHeader
        icon={FileText}
        title="Change requests"
        description="Track listing updates pending admin review"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRequests}
            disabled={loading}
          >
            <RefreshCw
              className={cn("h-4 w-4 mr-2", loading && "animate-spin")}
            />
            Refresh
          </Button>
        }
      />

      {/* Stats Cards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-2 gap-4 md:grid-cols-4"
      >
        <Card className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-3">
            <CardDescription className="text-amber-600">
              Pending
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-amber-600">
              {stats.pending}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-3">
            <CardDescription className="text-red-600">Overdue</CardDescription>
            <CardTitle className="text-3xl font-bold text-red-600">
              {stats.overdue}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-3">
            <CardDescription className="text-emerald-600">
              Approved
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-emerald-600">
              {stats.approved}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl border border-border/50 bg-background/60 backdrop-blur-sm shadow-sm">
          <CardHeader className="pb-3">
            <CardDescription className="text-muted-foreground">
              Rejected
            </CardDescription>
            <CardTitle className="text-3xl font-bold text-muted-foreground">
              {stats.rejected}
            </CardTitle>
          </CardHeader>
        </Card>
      </motion.div>

      {/* Requests List */}
      <motion.div variants={itemVariants}>
        {loading ? (
          <Card className={cn("rounded-2xl", BUSINESS_OWNER_CARD_SURFACE)}>
            <CardContent className="p-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Loading change requests...
              </p>
            </CardContent>
          </Card>
        ) : requests.length === 0 ? (
          <div className={BUSINESS_OWNER_EMPTY_STATE}>
            <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto mb-6">
              <FileText className="h-12 w-12 text-primary" />
            </div>
            <h3 className="text-2xl font-semibold text-foreground mb-3">
              No change requests yet
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              When you submit major listing updates, they appear here for admin
              review.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {requests.map((request) => {
                const isOverdue =
                  request.status === "pending" &&
                  request.sla_deadline &&
                  isPast(new Date(request.sla_deadline));

                return (
                  <motion.div
                    key={request.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card
                      className={cn(
                        "overflow-hidden transition-all duration-300",
                        BUSINESS_OWNER_CARD_SURFACE,
                        isOverdue
                          ? "border-red-500/40"
                          : "hover:border-primary/30",
                      )}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-3">
                            {/* Header */}
                            <div className="flex items-start gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <h3 className="font-semibold text-lg">
                                    {request.listings?.name ||
                                      "Unknown Listing"}
                                  </h3>
                                  {getStatusBadge(request.status)}
                                  {getPriorityBadge(request.priority)}
                                  {isOverdue && (
                                    <Badge
                                      variant="destructive"
                                      className="gap-1.5 animate-pulse"
                                    >
                                      <AlertCircle className="h-3 w-3" />
                                      Overdue
                                    </Badge>
                                  )}
                                </div>

                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <div className="flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5" />
                                    {formatDistanceToNow(
                                      new Date(request.created_at),
                                      {
                                        addSuffix: true,
                                      },
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <FileText className="h-3.5 w-3.5" />
                                    {formatChangeType(request.change_type)}
                                  </div>
                                  {request.sla_deadline &&
                                    request.status === "pending" && (
                                      <div
                                        className={`flex items-center gap-1.5 ${
                                          isOverdue
                                            ? "text-red-600 font-medium"
                                            : ""
                                        }`}
                                      >
                                        <Clock className="h-3.5 w-3.5" />
                                        SLA:{" "}
                                        {formatDistanceToNow(
                                          new Date(request.sla_deadline),
                                          {
                                            addSuffix: true,
                                          },
                                        )}
                                      </div>
                                    )}
                                </div>
                              </div>
                            </div>

                            {/* Change Summary */}
                            <div className="pl-4 border-l-2 border-primary/20">
                              {renderChangeSummary(request)}
                            </div>

                            {/* Reason (if provided) */}
                            {request.reason && (
                              <div className="p-3 bg-muted/50 rounded-lg">
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  Reason for Change
                                </p>
                                <p className="text-sm text-foreground">
                                  {request.reason}
                                </p>
                              </div>
                            )}

                            {/* Review Notes (if rejected) */}
                            {request.status === "rejected" &&
                              request.review_notes && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                  <p className="text-xs font-medium text-red-600 mb-1">
                                    Rejection Reason
                                  </p>
                                  <p className="text-sm text-foreground">
                                    {request.review_notes}
                                  </p>
                                  {request.reviewed_at && (
                                    <p className="text-xs text-muted-foreground mt-2">
                                      Reviewed{" "}
                                      {format(
                                        new Date(request.reviewed_at),
                                        "PPp",
                                      )}
                                    </p>
                                  )}
                                </div>
                              )}
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(request)}
                            >
                              <Eye className="h-4 w-4 mr-1.5" />
                              Details
                            </Button>
                            {request.status === "pending" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelRequest(request.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-500/10"
                              >
                                <XCircle className="h-4 w-4 mr-1.5" />
                                Cancel
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Change Request Details</DialogTitle>
            <DialogDescription>
              Review all changes and their current status
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6">
              {/* Meta Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Listing
                  </p>
                  <p className="font-semibold">
                    {selectedRequest.listings?.name}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Status
                  </p>
                  <div className="mt-1">
                    {getStatusBadge(selectedRequest.status)}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Change Type
                  </p>
                  <p className="font-semibold">
                    {formatChangeType(selectedRequest.change_type)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Submitted
                  </p>
                  <p className="font-semibold">
                    {format(new Date(selectedRequest.created_at), "PPp")}
                  </p>
                </div>
              </div>

              {/* All Changes */}
              <div>
                <h3 className="font-semibold mb-3">Proposed Changes</h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {Object.keys(selectedRequest.proposed_data).map((key) => {
                    const currentValue = selectedRequest.current_data[key];
                    const proposedValue = selectedRequest.proposed_data[key];

                    if (currentValue === proposedValue) return null;

                    return (
                      <div
                        key={key}
                        className="p-3 bg-muted/50 rounded-lg border border-border"
                      >
                        <p className="text-sm font-medium mb-2 capitalize">
                          {key.replace(/_/g, " ")}
                        </p>
                        <div className="space-y-2">
                          <div className="p-2 bg-background rounded">
                            <p className="text-xs text-muted-foreground mb-1">
                              Current
                            </p>
                            <p className="text-sm font-mono break-words">
                              {String(currentValue || "N/A")}
                            </p>
                          </div>
                          <div className="p-2 bg-primary/5 rounded border border-primary/20">
                            <p className="text-xs text-muted-foreground mb-1">
                              Proposed
                            </p>
                            <p className="text-sm font-mono break-words font-medium">
                              {String(proposedValue || "N/A")}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Close
            </Button>
            {selectedRequest?.status === "pending" && (
              <Button
                variant="destructive"
                onClick={() => handleCancelRequest(selectedRequest.id)}
                disabled={canceling}
              >
                {canceling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel Request
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
