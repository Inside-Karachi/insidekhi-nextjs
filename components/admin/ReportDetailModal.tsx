"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Flag, Trash2, Star, Loader2 } from "lucide-react";
import { REPORT_REASONS } from "@/lib/reports/reasons";
import type { ContentReport } from "@/components/admin/ReportsManagementPage";

interface ReportDetailModalProps {
  report: ContentReport | null;
  isOpen: boolean;
  onClose: () => void;
  /** Called after a dismiss or moderation action succeeds, so the parent can refetch the list. */
  onHandled: () => void;
}

const reasonLabel = (value: string) =>
  REPORT_REASONS.find((r) => r.value === value)?.label ?? value;

export function ReportDetailModal({
  report,
  isOpen,
  onClose,
  onHandled,
}: ReportDetailModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState<string | null>(null);
  const { toast } = useToast();

  if (!report) return null;

  const isReview = report.content_type === "review";

  const handleDismiss = async () => {
    setIsSubmitting("dismiss");
    try {
      const res = await fetch(`/api/admin/reports/${report.id}/dismiss`, {
        method: "POST",
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast({ title: "Report dismissed" });
      onHandled();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to dismiss report",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleModerate = async (status: "approved" | "rejected" | "flagged") => {
    setIsSubmitting(status);
    try {
      const endpoint = isReview
        ? `/api/admin/reviews/${report.content_id}/moderate`
        : `/api/admin/comments/${report.content_id}/moderate`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast({ title: `${isReview ? "Review" : "Comment"} ${status}` });
      onHandled();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to moderate content",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete this ${report.content_type}? This can't be undone.`)) return;
    setIsSubmitting("delete");
    try {
      const endpoint = isReview
        ? `/api/admin/reviews/${report.content_id}`
        : `/api/admin/comments/${report.content_id}/moderate`;
      const res = await fetch(endpoint, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast({ title: `${isReview ? "Review" : "Comment"} deleted` });
      onHandled();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete content",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <DialogTitle>Reported {isReview ? "review" : "comment"}</DialogTitle>
            <Badge variant="outline" className="capitalize">{report.status}</Badge>
          </div>
          {report.listing_name && (
            <DialogDescription>at {report.listing_name}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            {isReview && report.rating != null && (
              <div className="flex items-center gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    className={`h-3.5 w-3.5 ${n <= (report.rating || 0) ? "fill-primary text-primary" : "text-muted-foreground"}`}
                  />
                ))}
              </div>
            )}
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {report.content_snippet || "(content unavailable - it may have been deleted)"}
            </p>
            {report.content_status && (
              <p className="text-xs text-muted-foreground mt-2">
                Current status: <span className="capitalize">{report.content_status}</span>
              </p>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-sm">
              <span className="text-muted-foreground">Reason:</span>{" "}
              <span className="font-medium">{reasonLabel(report.reason)}</span>
            </p>
            {report.details && (
              <p className="text-sm">
                <span className="text-muted-foreground">Details:</span> {report.details}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Reported by {report.reporter_name || "Unknown user"} on{" "}
              {new Date(report.created_at).toLocaleString()}
            </p>
          </div>
        </div>

        {report.status === "pending" && (
          <DialogFooter className="flex flex-col gap-2 sm:flex-col sm:space-x-0">
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1 text-green-600 hover:text-green-700 border-green-200"
                onClick={() => handleModerate("approved")}
                disabled={!!isSubmitting}
              >
                {isSubmitting === "approved" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-1" />}
                Approve
              </Button>
              <Button
                variant="outline"
                className="flex-1 text-red-600 hover:text-red-700 border-red-200"
                onClick={() => handleModerate("rejected")}
                disabled={!!isSubmitting}
              >
                {isSubmitting === "rejected" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
                Reject
              </Button>
              {!isReview && (
                <Button
                  variant="outline"
                  className="flex-1 text-amber-600 hover:text-amber-700 border-amber-200"
                  onClick={() => handleModerate("flagged")}
                  disabled={!!isSubmitting}
                >
                  {isSubmitting === "flagged" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Flag className="h-4 w-4 mr-1" />}
                  Flag
                </Button>
              )}
            </div>
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleDismiss}
                disabled={!!isSubmitting}
              >
                {isSubmitting === "dismiss" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Dismiss report
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleDelete}
                disabled={!!isSubmitting}
              >
                {isSubmitting === "delete" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                Delete {report.content_type}
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
