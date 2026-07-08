"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ClipboardList,
  Clock,
  Inbox,
  Mail,
  Phone,
  Building,
  MapPin,
  ArrowRight,
  FileText,
  UserPlus,
  MessageSquare,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { cn } from "@/lib/utils";
import type { FormsOverviewData } from "@/types/form.types";

interface PremiumFormActivityHubProps {
  forms?: FormsOverviewData;
  className?: string;
  showAllSubmissions?: boolean;
}

// Utility function to format form types consistently
function formatFormType(value: string): string {
  return value
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// Get status badge styling based on status value
function getStatusBadgeClass(status: string | null): string {
  if (!status) {
    return "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
  }

  switch (status.toLowerCase()) {
    case "pending":
    case "new":
      return "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    case "in_review":
    case "processing":
      return "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    case "approved":
    case "completed":
    case "resolved":
      return "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    case "rejected":
    case "closed":
      return "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800";
    default:
      return "bg-slate-50 dark:bg-slate-950/30 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800";
  }
}

// Get form type icon based on form type
function getFormTypeIcon(formType: string) {
  const type = formType.toLowerCase();
  if (type.includes("membership")) {
    return <UserPlus className="h-4 w-4" />;
  }
  if (type.includes("get") && type.includes("list")) {
    return <Building className="h-4 w-4" />;
  }
  if (type.includes("contact")) {
    return <MessageSquare className="h-4 w-4" />;
  }
  return <FileText className="h-4 w-4" />;
}

// Get form type color scheme
function getFormTypeColor(formType: string): {
  bg: string;
  border: string;
  text: string;
} {
  const type = formType.toLowerCase();
  if (type.includes("membership")) {
    return {
      bg: "bg-blue-500/10 dark:bg-blue-500/20",
      border: "border-blue-500/20",
      text: "text-blue-500",
    };
  }
  if (type.includes("get") && type.includes("list")) {
    return {
      bg: "bg-purple-500/10 dark:bg-purple-500/20",
      border: "border-purple-500/20",
      text: "text-purple-500",
    };
  }
  if (type.includes("contact")) {
    return {
      bg: "bg-green-500/10 dark:bg-green-500/20",
      border: "border-green-500/20",
      text: "text-green-500",
    };
  }
  return {
    bg: "bg-primary/10 dark:bg-primary/20",
    border: "border-primary/20",
    text: "text-primary",
  };
}

// Memoized Stats Card Component for performance
const StatsCard = React.memo(
  ({
    label,
    value,
    icon: Icon,
    accentColor,
    delay,
  }: {
    label: string;
    value: number;
    icon: React.ElementType;
    accentColor: string;
    delay: number;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/40 p-5 shadow-sm",
        "bg-gradient-to-br from-background/80 to-background/60",
        "group hover:shadow-md transition-all duration-300"
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative z-10 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-2xl font-bold">{value.toLocaleString()}</p>
        </div>
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
            accentColor
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </motion.div>
  )
);

StatsCard.displayName = "StatsCard";

// Memoized Activity Item Component
const ActivityItem = React.memo(
  ({
    formType,
    total,
    pending,
    lastSubmittedAt,
    completion,
    index,
  }: {
    formType: string;
    total: number;
    pending: number;
    lastSubmittedAt: string | null;
    completion: number;
    index: number;
  }) => {
    const colors = getFormTypeColor(formType);

    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.08, duration: 0.4 }}
        className={cn(
          "group relative overflow-hidden rounded-xl border p-4",
          "bg-gradient-to-br from-background/90 to-background/70",
          "hover:border-primary/30 transition-all duration-300",
          colors.border
        )}
      >
        {/* Hover gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="relative z-10 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "p-2 rounded-lg transition-transform duration-300 group-hover:scale-110",
                  colors.bg,
                  colors.border,
                  "border"
                )}
              >
                <div className={colors.text}>{getFormTypeIcon(formType)}</div>
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {formatFormType(formType)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {total.toLocaleString()} total submissions
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "rounded-full text-xs font-medium",
                pending > 0
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400"
              )}
            >
              {pending > 0 ? `${pending} pending` : "All reviewed"}
            </Badge>
          </div>

          {/* Progress Bar */}
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-border/40">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${completion}%` }}
              transition={{ delay: index * 0.08 + 0.2, duration: 0.6 }}
              className={cn(
                "h-full rounded-full bg-gradient-to-r",
                colors.text === "text-blue-500" &&
                  "from-blue-500 via-blue-400 to-blue-300",
                colors.text === "text-purple-500" &&
                  "from-purple-500 via-purple-400 to-purple-300",
                colors.text === "text-green-500" &&
                  "from-green-500 via-green-400 to-green-300",
                colors.text === "text-primary" &&
                  "from-primary via-primary/80 to-primary/60"
              )}
            />
          </div>

          {/* Last Update */}
          {lastSubmittedAt && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                Latest: <RelativeTime date={lastSubmittedAt} />
              </span>
            </div>
          )}
        </div>
      </motion.div>
    );
  }
);

ActivityItem.displayName = "ActivityItem";

// Memoized Submission Card Component
const SubmissionCard = React.memo(
  ({
    submission,
    index,
  }: {
    submission: {
      id: number;
      form_type: string | null;
      status: string | null;
      submitted_at: string | null;
      email: string | null;
      phone: string | null;
      name: string | null;
      company_name: string | null;
      attachmentsCount?: number;
    };
    index: number;
  }) => {
    const formType = submission.form_type ?? "unknown";
    const colors = getFormTypeColor(formType);
    const attachmentsCount = submission.attachmentsCount ?? 0;

    // Extract contact info from submission
    const email = submission.email ?? null;
    const phone = submission.phone ?? null;
    const name = submission.name ?? submission.company_name ?? null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.06, duration: 0.4 }}
        className={cn(
          "group relative overflow-hidden rounded-xl border p-4",
          "bg-gradient-to-br from-background/90 to-background/70",
          "hover:border-primary/30 hover:shadow-md transition-all duration-300",
          "border-border/40"
        )}
      >
        {/* Hover gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/3 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="relative z-10 space-y-3">
          {/* Header with badges */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className={cn(
                  "rounded-full text-xs font-semibold uppercase tracking-wider",
                  colors.bg,
                  colors.border,
                  colors.text,
                  "border"
                )}
              >
                {formatFormType(formType)}
              </Badge>
              <Badge
                variant="outline"
                className={getStatusBadgeClass(submission.status)}
              >
                {submission.status ? submission.status : "New"}
              </Badge>
            </div>
            {submission.submitted_at && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <RelativeTime date={submission.submitted_at} />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="space-y-2">
            {name && (
              <div className="flex items-center gap-2">
                <Building className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">{name}</p>
              </div>
            )}
            {email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{email}</p>
              </div>
            )}
            {phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{phone}</p>
              </div>
            )}
            {attachmentsCount > 0 && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  {attachmentsCount} attachment
                  {attachmentsCount !== 1 ? "s" : ""}
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    );
  }
);

SubmissionCard.displayName = "SubmissionCard";

export function PremiumFormActivityHub({
  forms,
  className,
  showAllSubmissions = false,
}: PremiumFormActivityHubProps) {
  // Empty state when no forms data
  if (!forms) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className={cn(
          "relative overflow-hidden rounded-2xl border border-dashed border-border/60 p-8 text-center backdrop-blur-sm",
          "bg-gradient-to-br from-background/60 to-background/40",
          className
        )}
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ClipboardList className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-semibold">Form Management Hub</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          Keep track of membership, get-listed, and contact submissions in one
          centralized location. Real-time updates and activity monitoring.
        </p>
        <Button asChild className="mt-6">
          <Link href="/admin/forms">
            View Form Inbox
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </motion.div>
    );
  }

  const { totals, byType, latest } = forms;
  const submissionLimit = showAllSubmissions ? latest.length : 5;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent border-orange-500/20 p-6 backdrop-blur-sm transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/25",
        className
      )}
    >
      {/* Subtle background accents matching Events/Listings pattern */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />

      <div className="relative z-10 space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-gradient-to-br from-orange-500/15 via-orange-500/8 to-orange-500/3 px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-orange-500">
              <ClipboardList className="h-3.5 w-3.5" />
              Form Management Hub
            </div>
            <h3 className="mt-4 text-xl font-semibold">
              Submission Activity & Overview
            </h3>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Real-time monitoring of all form submissions across membership,
              get-listed, and contact channels.
            </p>
          </div>
          <Button
            asChild
            className="inline-flex items-center gap-2 bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 border border-orange-500/30 transition-all duration-300"
          >
            <Link href="/admin/forms">
              Open Full Inbox
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-3">
          <StatsCard
            label="Total Submissions"
            value={totals.overall}
            icon={Inbox}
            accentColor="bg-gradient-to-br from-orange-500/20 via-orange-500/10 to-orange-500/5 text-orange-500"
            delay={0.1}
          />
          <StatsCard
            label="Awaiting Review"
            value={totals.pending}
            icon={Clock}
            accentColor="bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-amber-500/5 text-amber-500"
            delay={0.2}
          />
          <StatsCard
            label="Last 24 Hours"
            value={totals.last24Hours}
            icon={TrendingUp}
            accentColor="bg-gradient-to-br from-orange-600/20 via-orange-600/10 to-orange-600/5 text-orange-600"
            delay={0.3}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Activity Breakdown - Left Side (2 columns) */}
          <div className="lg:col-span-2 space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Activity Breakdown</h3>
              <p className="text-sm text-muted-foreground">
                Distribution of submissions by form type
              </p>
            </div>

            {byType.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                No form activity yet. New submissions will appear here
                automatically.
              </div>
            ) : (
              <div className="space-y-3">
                {byType.slice(0, 4).map((item, index) => {
                  const completion = totals.overall
                    ? Math.min(
                        100,
                        Math.round((item.total / totals.overall) * 100)
                      )
                    : 0;

                  return (
                    <ActivityItem
                      key={item.formType}
                      formType={item.formType}
                      total={item.total}
                      pending={item.pending}
                      lastSubmittedAt={item.lastSubmittedAt}
                      completion={completion}
                      index={index}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Submissions - Right Side (3 columns) */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Recent Submissions</h3>
                <p className="text-sm text-muted-foreground">
                  Latest entries requiring attention
                </p>
              </div>
              {latest.length > 5 && !showAllSubmissions && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/admin/forms">
                    View All
                    <ArrowRight className="ml-2 h-3 w-3" />
                  </Link>
                </Button>
              )}
            </div>

            {latest.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                You&apos;re all caught up! New submissions will appear here
                instantly.
              </div>
            ) : (
              <div className="space-y-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
                {latest.slice(0, submissionLimit).map((submission, index) => (
                  <SubmissionCard
                    key={submission.id}
                    submission={submission}
                    index={index}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
