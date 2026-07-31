"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
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
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  PenSquare,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";

type ApplicationStatus = "pending" | "approved" | "rejected";

interface Application {
  id: number;
  user_id: string;
  message: string;
  portfolio_url: string | null;
  status: ApplicationStatus;
  review_notes: string | null;
  created_at: string;
  applicant_full_name?: string | null;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

type StatVariant = "orange" | "green" | "red";

const statVariantStyles: Record<
  StatVariant,
  { card: string; title: string; value: string; iconWrapper: string; icon: string }
> = {
  orange: {
    card: "bg-gradient-to-br from-orange-500/20 via-orange-500/10 to-orange-500/5 dark:from-orange-500/10 dark:via-orange-500/5 dark:to-orange-500/0 border-orange-500/30 dark:border-orange-500/20",
    title: "text-sm font-medium text-orange-900 dark:text-orange-100",
    value: "text-2xl font-bold text-orange-700 dark:text-orange-300",
    iconWrapper: "p-2 bg-orange-500/10 rounded-lg",
    icon: "h-4 w-4 text-orange-600 dark:text-orange-400",
  },
  green: {
    card: "bg-gradient-to-br from-green-500/20 via-green-500/10 to-green-500/5 dark:from-green-500/10 dark:via-green-500/5 dark:to-green-500/0 border-green-500/30 dark:border-green-500/20",
    title: "text-sm font-medium text-green-900 dark:text-green-100",
    value: "text-2xl font-bold text-green-700 dark:text-green-300",
    iconWrapper: "p-2 bg-green-500/10 rounded-lg",
    icon: "h-4 w-4 text-green-600 dark:text-green-400",
  },
  red: {
    card: "bg-gradient-to-br from-red-500/20 via-red-500/10 to-red-500/5 dark:from-red-500/10 dark:via-red-500/5 dark:to-red-500/0 border-red-500/30 dark:border-red-500/20",
    title: "text-sm font-medium text-red-900 dark:text-red-100",
    value: "text-2xl font-bold text-red-700 dark:text-red-300",
    iconWrapper: "p-2 bg-red-500/10 rounded-lg",
    icon: "h-4 w-4 text-red-600 dark:text-red-400",
  },
};

export function WriterApplicationsPage() {
  const [applications, setApplications] = React.useState<Application[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState("pending");
  const [page, setPage] = React.useState(1);
  const [pagination, setPagination] = React.useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });
  const [stats, setStats] = React.useState({
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
  });

  const [selectedApp, setSelectedApp] = React.useState<Application | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = React.useState(false);
  const [reviewAction, setReviewAction] = React.useState<"approve" | "reject">(
    "approve",
  );
  const [reviewNotes, setReviewNotes] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const { toast } = useToast();

  const fetchApplications = React.useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        status: statusFilter,
        page: page.toString(),
        limit: "20",
      });
      const response = await fetch(
        `/api/admin/writer-applications?${params.toString()}`,
      );
      const result = await response.json();

      if (result.success) {
        setApplications(result.data.applications);
        setPagination(result.data.pagination);
        setStats({
          pendingCount: result.data.pendingCount || 0,
          approvedCount: result.data.approvedCount || 0,
          rejectedCount: result.data.rejectedCount || 0,
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to load applications",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching applications:", error);
      toast({
        title: "Error",
        description: "Failed to load applications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page, toast]);

  React.useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleReview = (app: Application, action: "approve" | "reject") => {
    setSelectedApp(app);
    setReviewAction(action);
    setReviewNotes("");
    setReviewDialogOpen(true);
  };

  const handleSubmitReview = async () => {
    if (!selectedApp) return;

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
      const response = await fetch("/api/admin/writer-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: selectedApp.id,
          action: reviewAction,
          review_notes: reviewNotes,
        }),
      });
      const result = await response.json();

      if (result.success) {
        toast({ title: "Success", description: result.data.message });
        setReviewDialogOpen(false);
        fetchApplications();
      } else {
        toast({ title: "Error", description: result.error, variant: "destructive" });
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

  return (
    <div className="space-y-6">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-2xl" />
        <div className="relative p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary/10 rounded-xl">
              <PenSquare className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Writer Applications
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Review applications from users who want to write guides.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { key: "pending", label: "Pending", value: stats.pendingCount, icon: Clock, color: "orange" as StatVariant },
          { key: "approved", label: "Approved", value: stats.approvedCount, icon: CheckCircle2, color: "green" as StatVariant },
          { key: "rejected", label: "Rejected", value: stats.rejectedCount, icon: XCircle, color: "red" as StatVariant },
        ].map((card) => {
          const styles = statVariantStyles[card.color];
          const Icon = card.icon;
          return (
            <Card key={card.key} className={styles.card}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className={styles.title}>{card.label}</CardTitle>
                <div className={styles.iconWrapper}>
                  <Icon className={styles.icon} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={styles.value}>{card.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border/50 bg-gradient-to-r from-background/50 to-background/30 p-6 backdrop-blur-sm">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-11 w-44 border-border/50 bg-background/50">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchApplications} disabled={loading} className="h-11">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-5 bg-muted rounded w-1/2 mb-2" />
                <div className="h-4 bg-muted rounded w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : applications.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Queue is Clear!</h3>
            <p className="text-muted-foreground">
              No applications match your current filter.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <motion.div key={app.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Card className="hover:shadow-lg transition-all duration-300">
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">
                      {app.applicant_full_name || "Unknown user"}
                    </h3>
                    <Badge
                      variant={
                        app.status === "approved"
                          ? "default"
                          : app.status === "rejected"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {app.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {app.message}
                  </p>
                  {app.portfolio_url && (
                    <a
                      href={app.portfolio_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View portfolio
                    </a>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Applied {format(new Date(app.created_at), "PPp")}
                  </p>
                  {app.review_notes && (
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        Review Notes
                      </p>
                      <p className="text-sm">{app.review_notes}</p>
                    </div>
                  )}
                  {app.status === "pending" && (
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => handleReview(app, "approve")}
                        className="h-9 bg-emerald-600 hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1.5" />
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleReview(app, "reject")}
                        className="h-9"
                      >
                        <XCircle className="h-4 w-4 mr-1.5" />
                        Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
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

      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approve" ? "Approve Application" : "Reject Application"}
            </DialogTitle>
            <DialogDescription>
              {selectedApp?.applicant_full_name || "Unknown user"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Review Notes{" "}
                {reviewAction === "reject" && <span className="text-destructive">*</span>}
              </label>
              <Textarea
                placeholder={
                  reviewAction === "approve"
                    ? "Optional notes..."
                    : "Please explain why this application is being rejected..."
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
    </div>
  );
}
