"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { REPORT_REASONS } from "@/lib/reports/reasons";
import type { ContentReport } from "@/components/admin/ReportsManagementPage";

interface ReportsTableProps {
  reports: ContentReport[];
  isLoading?: boolean;
  onOpenReport: (report: ContentReport) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const reasonLabel = (value: string) =>
  REPORT_REASONS.find((r) => r.value === value)?.label ?? value;

const statusBadgeColor: Record<ContentReport["status"], string> = {
  pending:
    "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  resolved:
    "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  dismissed:
    "bg-slate-50 dark:bg-slate-950/30 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800",
};

export function ReportsTable({
  reports,
  isLoading,
  onOpenReport,
  currentPage,
  totalPages,
  onPageChange,
}: ReportsTableProps) {
  if (isLoading && reports.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isLoading && reports.length === 0) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-16 text-center text-muted-foreground">
          No reports match these filters.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((report) => (
        <Card
          key={report.id}
          onClick={() => onOpenReport(report)}
          className="border-border/50 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
        >
          <CardContent className="p-4 flex items-start gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              {report.content_type === "review" ? (
                <Star className="h-4 w-4 text-primary" />
              ) : (
                <MessageSquare className="h-4 w-4 text-primary" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <Badge variant="outline" className="capitalize text-xs">
                  {report.content_type}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn("text-xs", statusBadgeColor[report.status])}
                >
                  {report.status}
                </Badge>
                {report.listing_name && (
                  <span className="text-xs text-muted-foreground truncate">
                    {report.listing_name}
                  </span>
                )}
              </div>

              <p className="text-sm text-foreground truncate">
                {report.content_snippet || "(content unavailable)"}
              </p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                <span>
                  Reason: <span className="font-medium text-foreground">{reasonLabel(report.reason)}</span>
                </span>
                <span>Reported by {report.reporter_name || "Unknown user"}</span>
                <span>{new Date(report.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2 pt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
