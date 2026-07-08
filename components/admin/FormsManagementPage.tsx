"use client";

import * as React from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Mail,
  Phone,
  Building,
  MapPin,
  RefreshCw,
  Search,
  UploadCloud,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/useDebounce";
import { RelativeTime } from "@/components/ui/RelativeTime";
import type {
  FormSubmissionWithAssets,
  FormsOverviewTotals,
} from "@/types/form.types";
import { FormSubmissionModal } from "./FormSubmissionModal";

interface FormsApiPayload {
  success: boolean;
  submissions: FormSubmissionWithAssets[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  formTypes: string[];
  statusCounts: Record<string, number>;
  metrics: FormsOverviewTotals;
  error?: string;
  typeBreakdown?: Array<{
    formType: string;
    total: number;
    pending: number;
    lastSubmittedAt: string | null;
  }>;
}

const shimmerCards = Array.from({ length: 6 });

function formatFormType(value: string) {
  return value
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatStatusLabel(status: string | null) {
  if (!status) return "New";
  return status
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusBadgeClass(status: string | null) {
  if (!status || status === "pending") {
    return "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
  }

  switch (status.toLowerCase()) {
    case "approved":
    case "completed":
    case "resolved":
      return "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    case "in_review":
    case "processing":
      return "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    case "rejected":
    case "closed":
      return "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
    default:
      return "bg-slate-50 dark:bg-slate-950/30 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800";
  }
}

function getAdditionalField(
  data: FormSubmissionWithAssets["additional_data"],
  key: string
) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return undefined;
  }

  const record = data as Record<string, unknown>;
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

type StatVariant = "blue" | "orange" | "purple" | "green" | "indigo";

const statVariantStyles: Record<
  StatVariant,
  {
    card: string;
    title: string;
    iconWrapper: string;
    icon: string;
    value: string;
  }
> = {
  blue: {
    card: "bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-blue-500/5 dark:from-blue-500/10 dark:via-blue-500/5 dark:to-blue-500/0 border-blue-500/30 dark:border-blue-500/20 hover:shadow-xl hover:shadow-blue-500/25 transition-all duration-300 group cursor-pointer",
    title:
      "text-sm font-medium text-blue-900 dark:text-blue-100 group-hover:text-blue-800 dark:group-hover:text-blue-200 transition-colors",
    iconWrapper:
      "p-2 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors",
    icon: "h-4 w-4 text-blue-600 dark:text-blue-400",
    value:
      "text-2xl font-bold text-blue-700 dark:text-blue-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors",
  },
  orange: {
    card: "bg-gradient-to-br from-orange-500/20 via-orange-500/10 to-orange-500/5 dark:from-orange-500/10 dark:via-orange-500/5 dark:to-orange-500/0 border-orange-500/30 dark:border-orange-500/20 hover:shadow-xl hover:shadow-orange-500/25 transition-all duration-300 group cursor-pointer",
    title:
      "text-sm font-medium text-orange-900 dark:text-orange-100 group-hover:text-orange-800 dark:group-hover:text-orange-200 transition-colors",
    iconWrapper:
      "p-2 bg-orange-500/10 rounded-lg group-hover:bg-orange-500/20 transition-colors",
    icon: "h-4 w-4 text-orange-600 dark:text-orange-400",
    value:
      "text-2xl font-bold text-orange-700 dark:text-orange-300 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors",
  },
  purple: {
    card: "bg-gradient-to-br from-purple-500/20 via-purple-500/10 to-purple-500/5 dark:from-purple-500/10 dark:via-purple-500/5 dark:to-purple-500/0 border-purple-500/30 dark:border-purple-500/20 hover:shadow-xl hover:shadow-purple-500/25 transition-all duration-300 group cursor-pointer",
    title:
      "text-sm font-medium text-purple-900 dark:text-purple-100 group-hover:text-purple-800 dark:group-hover:text-purple-200 transition-colors",
    iconWrapper:
      "p-2 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors",
    icon: "h-4 w-4 text-purple-600 dark:text-purple-400",
    value:
      "text-2xl font-bold text-purple-700 dark:text-purple-300 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors",
  },
  green: {
    card: "bg-gradient-to-br from-green-500/20 via-green-500/10 to-green-500/5 dark:from-green-500/10 dark:via-green-500/5 dark:to-green-500/0 border-green-500/30 dark:border-green-500/20 hover:shadow-xl hover:shadow-green-500/25 transition-all duration-300 group cursor-pointer",
    title:
      "text-sm font-medium text-green-900 dark:text-green-100 group-hover:text-green-800 dark:group-hover:text-green-200 transition-colors",
    iconWrapper:
      "p-2 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors",
    icon: "h-4 w-4 text-green-600 dark:text-green-400",
    value:
      "text-2xl font-bold text-green-700 dark:text-green-300 group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors",
  },
  indigo: {
    card: "bg-gradient-to-br from-indigo-500/20 via-indigo-500/10 to-indigo-500/5 dark:from-indigo-500/10 dark:via-indigo-500/5 dark:to-indigo-500/0 border-indigo-500/30 dark:border-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/25 transition-all duration-300 group cursor-pointer",
    title:
      "text-sm font-medium text-indigo-900 dark:text-indigo-100 group-hover:text-indigo-800 dark:group-hover:text-indigo-200 transition-colors",
    iconWrapper:
      "p-2 bg-indigo-500/10 rounded-lg group-hover:bg-indigo-500/20 transition-colors",
    icon: "h-4 w-4 text-indigo-600 dark:text-indigo-400",
    value:
      "text-2xl font-bold text-indigo-700 dark:text-indigo-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors",
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4 },
  },
};

export function FormsManagementPage() {
  const { toast } = useToast();
  const [submissions, setSubmissions] = React.useState<
    FormSubmissionWithAssets[]
  >([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [formTypes, setFormTypes] = React.useState<string[]>([]);
  const [statusCounts, setStatusCounts] = React.useState<
    Record<string, number>
  >({});
  const [metrics, setMetrics] = React.useState<FormsOverviewTotals | null>(
    null
  );

  const [selectedFormType, setSelectedFormType] = React.useState<string>("all");
  const [selectedStatus, setSelectedStatus] = React.useState<string>("all");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState<string>("");
  const [dateTo, setDateTo] = React.useState<string>("");
  const debouncedSearch = useDebounce(searchTerm, 400);

  const [activeSubmission, setActiveSubmission] =
    React.useState<FormSubmissionWithAssets | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const fetchSubmissions = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "12");

      if (selectedFormType !== "all") params.set("form_type", selectedFormType);
      if (selectedStatus !== "all") params.set("status", selectedStatus);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);

      const response = await fetch(`/api/admin/forms?${params.toString()}`);
      const result: FormsApiPayload = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result?.error || "Failed to fetch form submissions");
      }

      setSubmissions(result.submissions);
      setTotalPages(result.pagination.totalPages || 1);
      setFormTypes(result.formTypes || []);
      setStatusCounts(result.statusCounts || {});
      setMetrics(result.metrics);
    } catch (error) {
      console.error("Failed to fetch form submissions", error);
      toast({
        title: "Unable to load forms",
        description: "We couldn't load the submissions feed. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [
    page,
    selectedFormType,
    selectedStatus,
    debouncedSearch,
    dateFrom,
    dateTo,
    toast,
  ]);

  React.useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  React.useEffect(() => {
    setPage(1);
  }, [selectedFormType, selectedStatus, debouncedSearch, dateFrom, dateTo]);

  // Realtime subscription for form_submissions table
  React.useEffect(() => {
    const setupRealtime = async () => {
      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();

      const channel = supabase
        .channel("form-submissions-changes")
        .on(
          "postgres_changes",
          {
            event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
            schema: "public",
            table: "form_submissions",
          },
          (payload) => {
            console.log("Form submission changed:", payload);

            // Refresh data when any change occurs
            // This ensures stats, counts, and individual submissions are all updated
            fetchSubmissions();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupRealtime();
  }, [fetchSubmissions]);

  const handleRefresh = () => {
    fetchSubmissions();
    toast({
      title: "Forms updated",
      description: "Latest submissions have been loaded.",
    });
  };

  const openModal = (submission: FormSubmissionWithAssets) => {
    setActiveSubmission(submission);
    setIsModalOpen(true);
  };

  const closeModal = (shouldRefresh = false) => {
    setIsModalOpen(false);
    setActiveSubmission(null);

    // Optionally refresh data when modal closes (e.g., after status update)
    if (shouldRefresh) {
      fetchSubmissions();
    }
  };

  // Fixed status options - consistent with modal workflow
  const statusOptions = React.useMemo(
    () => [
      { label: "All statuses", value: "all" },
      { label: "Pending", value: "pending" },
      { label: "In Review", value: "in_review" },
      { label: "Approved", value: "approved" },
      { label: "Rejected", value: "rejected" },
      { label: "Completed", value: "completed" },
    ],
    []
  );

  const normalizedStatusCounts = React.useMemo(() => {
    return Object.entries(statusCounts).reduce<Record<string, number>>(
      (accumulator, [key, value]) => {
        if (!key) return accumulator;
        accumulator[key.toLowerCase()] = value ?? 0;
        return accumulator;
      },
      {}
    );
  }, [statusCounts]);

  const submissionsCount = submissions.length;

  const totalSubmissions = React.useMemo(() => {
    if (metrics?.overall) {
      return metrics.overall;
    }

    const aggregated = Object.values(normalizedStatusCounts).reduce(
      (sum, count) => sum + count,
      0
    );

    if (aggregated > 0) {
      return aggregated;
    }

    return submissionsCount;
  }, [metrics, normalizedStatusCounts, submissionsCount]);

  const pendingCount = React.useMemo(() => {
    if (metrics?.pending !== undefined) {
      return metrics.pending;
    }

    return (
      (normalizedStatusCounts["pending"] ?? 0) +
      (normalizedStatusCounts["new"] ?? 0)
    );
  }, [metrics, normalizedStatusCounts]);

  const inReviewCount = React.useMemo(() => {
    return (
      (normalizedStatusCounts["in_review"] ?? 0) +
      (normalizedStatusCounts["processing"] ?? 0)
    );
  }, [normalizedStatusCounts]);

  const resolvedCount = React.useMemo(() => {
    return ["approved", "completed", "resolved"].reduce((sum, status) => {
      return sum + (normalizedStatusCounts[status] ?? 0);
    }, 0);
  }, [normalizedStatusCounts]);

  const last24Hours = metrics?.last24Hours ?? 0;

  const statsCards = React.useMemo<
    Array<{
      key: string;
      label: string;
      value: number;
      icon: LucideIcon;
      color: StatVariant;
    }>
  >(
    () => [
      {
        key: "total",
        label: "Total submissions",
        value: totalSubmissions,
        icon: ClipboardList,
        color: "blue" as StatVariant,
      },
      {
        key: "pending",
        label: "Pending review",
        value: pendingCount,
        icon: Clock,
        color: "orange" as StatVariant,
      },
      {
        key: "in-review",
        label: "In review",
        value: inReviewCount,
        icon: RefreshCw,
        color: "purple" as StatVariant,
      },
      {
        key: "resolved",
        label: "Resolved",
        value: resolvedCount,
        icon: CheckCircle2,
        color: "green" as StatVariant,
      },
      {
        key: "recent",
        label: "Last 24 hours",
        value: last24Hours,
        icon: CalendarClock,
        color: "indigo" as StatVariant,
      },
    ],
    [totalSubmissions, pendingCount, inReviewCount, resolvedCount, last24Hours]
  );

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div
        variants={itemVariants}
        className="relative overflow-hidden rounded-3xl border border-border/30 bg-gradient-to-br from-background/80 via-background/50 to-background/80 shadow-premium backdrop-blur-xl"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent" />
        <div className="relative z-10 p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                <ClipboardList className="h-3.5 w-3.5" />
                Forms
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent sm:text-4xl">
                  Forms Management
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
                  Review membership requests, get-listed submissions, and
                  contact enquiries as soon as they arrive.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5"
      >
        {statsCards.map((card) => {
          const styles = statVariantStyles[card.color];
          const Icon = card.icon;

          return (
            <motion.div
              key={card.key}
              variants={itemVariants}
              whileHover={{
                scale: 1.02,
                transition: { duration: 0.2 },
              }}
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

      <motion.div
        id="filters"
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
                className="h-11 bg-background/50 pl-11 pr-4 font-medium placeholder:font-normal border-border/50 focus:border-primary/50 focus-visible:ring-primary/20"
                placeholder="Search by name, company, or email…"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <Select
              value={selectedFormType}
              onValueChange={(value) => setSelectedFormType(value)}
            >
              <SelectTrigger className="h-11 w-full border-border/50 bg-background/50 md:w-48">
                <SelectValue placeholder="All forms" />
              </SelectTrigger>
              <SelectContent className="max-h-72 overflow-y-auto">
                <SelectItem value="all">All forms</SelectItem>
                {formTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatFormType(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedStatus}
              onValueChange={(value) => setSelectedStatus(value)}
            >
              <SelectTrigger className="h-11 w-full border-border/50 bg-background/50 md:w-48">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex w-full flex-col gap-4 md:w-auto md:flex-row md:items-end md:justify-end">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                placeholder="From date"
                className="h-11 w-full border-border/50 bg-background/50 text-sm font-medium focus:border-primary/50 focus-visible:ring-primary/20 sm:w-44"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                placeholder="To date"
                className="h-11 w-full border-border/50 bg-background/50 text-sm font-medium focus:border-primary/50 focus-visible:ring-primary/20 sm:w-44"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={handleRefresh}
              className="h-11 w-full border-border/50 px-6 hover:border-primary/40 hover:bg-primary/5 md:w-auto"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          </div>
        </div>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3"
      >
        {isLoading &&
          shimmerCards.map((_, index) => (
            <Card
              key={`forms-skeleton-${index}`}
              className="h-full bg-background/90 backdrop-blur-md border border-border/60 shadow-premium p-6"
            >
              <div className="h-4 w-24 animate-pulse rounded-full bg-muted/40" />
              <div className="mt-4 h-6 w-3/4 animate-pulse rounded bg-muted/40" />
              <div className="mt-6 space-y-3">
                <div className="h-3 w-full animate-pulse rounded bg-muted/30" />
                <div className="h-3 w-5/6 animate-pulse rounded bg-muted/30" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-muted/30" />
              </div>
              <div className="mt-6 flex gap-2">
                <div className="h-9 w-24 animate-pulse rounded bg-muted/40" />
                <div className="h-9 w-20 animate-pulse rounded bg-muted/40" />
              </div>
            </Card>
          ))}

        {!isLoading && submissions.length === 0 && (
          <div className="col-span-full">
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/60 bg-background/60 backdrop-blur-sm p-12 text-center shadow-premium">
              <UploadCloud className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-semibold">
                No submissions match these filters
              </h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Adjust your filters or wait for new submissions. You’re all
                caught up for now!
              </p>
              <Button
                className="mt-4"
                onClick={handleRefresh}
                variant="outline"
              >
                Refresh
              </Button>
            </div>
          </div>
        )}

        {!isLoading &&
          submissions.map((submission, index) => {
            const submissionSource = getAdditionalField(
              submission.additional_data,
              "submittedFrom"
            );

            return (
              <motion.div
                key={submission.id}
                variants={itemVariants}
                transition={{ delay: index * 0.03, duration: 0.3 }}
                whileHover={{ y: -2 }}
              >
                <Card className="group relative overflow-hidden flex flex-col h-full bg-background/90 backdrop-blur-md border border-border/60 shadow-premium hover:shadow-premium-lg transition-all duration-300 hover:shadow-primary/10 dark:hover:shadow-primary/20 p-6">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  <div className="relative z-10 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="rounded-full bg-primary/15 text-xs font-semibold uppercase tracking-wider text-primary">
                          {formatFormType(submission.form_type)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={statusBadgeClass(submission.status)}
                        >
                          {formatStatusLabel(submission.status)}
                        </Badge>
                        {(!submission.status ||
                          submission.status === "pending") && (
                          <Badge
                            variant="outline"
                            className="rounded-full border-emerald-300/30 bg-emerald-500/10 text-xs uppercase tracking-wider text-emerald-600"
                          >
                            New submission
                          </Badge>
                        )}
                      </div>
                      {submission.submitted_at && (
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CalendarClock className="h-3.5 w-3.5" />
                          <RelativeTime date={submission.submitted_at} />
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold text-foreground">
                        {submission.name ||
                          submission.company_name ||
                          "Anonymous"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {submission.message
                          ? submission.message.slice(0, 160) +
                            (submission.message.length > 160 ? "…" : "")
                          : "No additional message provided."}
                      </p>
                    </div>

                    <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          <span>{submission.email}</span>
                        </div>
                        {submission.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4" />
                            <span>{submission.phone}</span>
                          </div>
                        )}
                        {submission.company_name && (
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4" />
                            <span>{submission.company_name}</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        {submission.city && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{submission.city}</span>
                          </div>
                        )}
                        {submission.business_type && (
                          <div className="flex items-center gap-2">
                            <ClipboardList className="h-4 w-4" />
                            <span>{submission.business_type}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <UploadCloud className="h-4 w-4" />
                          <span>
                            {submission.attachmentsCount || 0} attachment
                            {submission.attachmentsCount === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {submissionSource && (
                        <Badge variant="outline" className="rounded-full">
                          Source: {submissionSource}
                        </Badge>
                      )}
                      {submission.website && (
                        <Badge variant="outline" className="rounded-full">
                          Website: {submission.website}
                        </Badge>
                      )}
                      {submission.years_in_business && (
                        <Badge variant="outline" className="rounded-full">
                          {submission.years_in_business} years in business
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={() => openModal(submission)}
                        className="gap-2 bg-gradient-to-r from-primary to-primary/85 text-primary-foreground shadow-sm shadow-primary/20 transition hover:from-primary/90 hover:to-primary"
                      >
                        Review submission
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
      </motion.div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            disabled={page === totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          >
            Next
          </Button>
        </div>
      )}

      <FormSubmissionModal
        submission={activeSubmission}
        open={isModalOpen}
        onOpenChange={(open: boolean) => {
          if (!open) closeModal();
        }}
        onReplySuccess={fetchSubmissions}
      />
    </motion.div>
  );
}
