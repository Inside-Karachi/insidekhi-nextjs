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
import { ReportsTable } from "@/components/admin/ReportsTable";
import { ReportDetailModal } from "@/components/admin/ReportDetailModal";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Clock, CheckCircle, XCircle } from "lucide-react";
import { REPORT_REASONS } from "@/lib/reports/reasons";

export type ContentReport = {
  id: number;
  content_type: "review" | "comment";
  content_id: number;
  reason: string;
  details: string | null;
  status: "pending" | "resolved" | "dismissed";
  created_at: string;
  resolved_at: string | null;
  reporter_name: string | null;
  content_snippet: string | null;
  rating: number | null;
  content_status: string | null;
  listing_name: string | null;
  listing_slug: string | null;
};

type StatusCounts = { pending: number; resolved: number; dismissed: number };

export function ReportsManagementPage() {
  const [reports, setReports] = React.useState<ContentReport[]>([]);
  const [statusCounts, setStatusCounts] = React.useState<StatusCounts>({
    pending: 0,
    resolved: 0,
    dismissed: 0,
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [statusFilter, setStatusFilter] = React.useState("pending");
  const [contentTypeFilter, setContentTypeFilter] = React.useState("all");
  const [reasonFilter, setReasonFilter] = React.useState("all");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [selectedReport, setSelectedReport] = React.useState<ContentReport | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const { toast } = useToast();

  const fetchReports = React.useCallback(
    async (page = currentPage) => {
      try {
        setIsLoading(true);
        const params = new URLSearchParams({
          status: statusFilter,
          content_type: contentTypeFilter,
          reason: reasonFilter,
          page: String(page),
          limit: "20",
        });
        const response = await fetch(`/api/admin/reports?${params}`);
        const result = await response.json();

        if (result.success) {
          setReports(result.data.reports);
          setStatusCounts(result.data.statusCounts);
          setTotalPages(Math.max(1, Math.ceil(result.data.total / result.data.limit)));
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        console.error("Fetch reports error:", error);
        toast({
          title: "Error",
          description: "Failed to fetch reports",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statusFilter, contentTypeFilter, reasonFilter],
  );

  React.useEffect(() => {
    setCurrentPage(1);
    fetchReports(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, contentTypeFilter, reasonFilter]);

  React.useEffect(() => {
    fetchReports(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  const handleOpenReport = (report: ContentReport) => {
    setSelectedReport(report);
    setIsModalOpen(true);
  };

  const handleReportHandled = () => {
    setIsModalOpen(false);
    setSelectedReport(null);
    fetchReports(currentPage);
  };

  const statsCards = [
    { title: "Pending", value: statusCounts.pending, icon: Clock, color: "text-amber-600 dark:text-amber-400" },
    { title: "Resolved", value: statusCounts.resolved, icon: CheckCircle, color: "text-emerald-600 dark:text-emerald-400" },
    { title: "Dismissed", value: statusCounts.dismissed, icon: XCircle, color: "text-muted-foreground" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statsCards.map((stat) => (
          <Card key={stat.title} className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-gradient-to-r from-background/50 to-background/30 backdrop-blur-sm border border-border/50 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44 h-11 bg-background/50 border-border/50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
                <SelectItem value="all">All Statuses</SelectItem>
              </SelectContent>
            </Select>

            <Select value={contentTypeFilter} onValueChange={setContentTypeFilter}>
              <SelectTrigger className="w-44 h-11 bg-background/50 border-border/50">
                <SelectValue placeholder="Content type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Reviews & Comments</SelectItem>
                <SelectItem value="review">Reviews only</SelectItem>
                <SelectItem value="comment">Comments only</SelectItem>
              </SelectContent>
            </Select>

            <Select value={reasonFilter} onValueChange={setReasonFilter}>
              <SelectTrigger className="w-52 h-11 bg-background/50 border-border/50">
                <SelectValue placeholder="Reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reasons</SelectItem>
                {REPORT_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            onClick={() => fetchReports(currentPage)}
            disabled={isLoading}
            className="h-11 px-6 bg-background/50 border-border/50 hover:bg-background/80"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <ReportsTable
        reports={reports}
        isLoading={isLoading}
        onOpenReport={handleOpenReport}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      <ReportDetailModal
        report={selectedReport}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedReport(null);
        }}
        onHandled={handleReportHandled}
      />
    </motion.div>
  );
}
