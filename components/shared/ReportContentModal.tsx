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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle } from "lucide-react";
import { REPORT_REASONS, type ReportReason } from "@/lib/reports/reasons";

interface ReportContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Builds the report endpoint, e.g. `/api/reviews/${reviewId}/report` or the comments variant. */
  endpoint: string;
}

export function ReportContentModal({
  isOpen,
  onClose,
  endpoint,
}: ReportContentModalProps) {
  const [reason, setReason] = React.useState<ReportReason | "">("");
  const [details, setDetails] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (isOpen) {
      setReason("");
      setDetails("");
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!reason) {
      toast({ title: "Please select a reason", variant: "destructive" });
      return;
    }
    if (reason === "other" && !details.trim()) {
      toast({ title: "Please describe the issue", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, details: details.trim() || undefined }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to submit report");
      }

      toast({
        title: "Report submitted",
        description: "Thank you for helping keep our community safe. We'll review it shortly.",
      });
      onClose();
    } catch (error) {
      toast({
        title: "Failed to submit report",
        description: error instanceof Error ? error.message : "Please try again later",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !submitting && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <DialogTitle className="text-left">Report this content</DialogTitle>
          </div>
          <DialogDescription className="text-left mt-2">
            Let us know why - this helps our team review it faster.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="report-reason">
              Reason<span className="text-destructive ml-1">*</span>
            </Label>
            <Select
              value={reason}
              onValueChange={(v) => setReason(v as ReportReason)}
              disabled={submitting}
            >
              <SelectTrigger id="report-reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {reason === "other" && (
            <div className="space-y-2">
              <Label htmlFor="report-details">
                Additional details<span className="text-destructive ml-1">*</span>
              </Label>
              <Textarea
                id="report-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Tell us more..."
                rows={3}
                className="resize-none"
                disabled={submitting}
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !reason}
            className="flex-1 sm:flex-none"
          >
            {submitting ? "Submitting..." : "Submit Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
