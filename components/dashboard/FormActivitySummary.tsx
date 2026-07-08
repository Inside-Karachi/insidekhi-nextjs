"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Building,
  ClipboardList,
  Mail,
  MapPin,
  Phone,
  UploadCloud,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { cn } from "@/lib/utils";
import type { FormsOverviewData } from "@/types/form.types";

interface FormActivitySummaryProps {
  forms?: FormsOverviewData;
  className?: string;
  latestLimit?: number;
}

function formatFormType(value: string) {
  return value
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusBadgeClass(status: string | null) {
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

export function FormActivitySummary({
  forms,
  className,
  latestLimit = 5,
}: FormActivitySummaryProps) {
  if (!forms) {
    return (
      <Card
        className={cn(
          "border-dashed border-border/60 bg-background/60",
          className
        )}
      >
        <CardHeader className="text-center">
          <CardTitle>Form activity</CardTitle>
          <CardDescription>
            Keep track of membership, get-listed, and contact submissions in one
            place.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ClipboardList className="h-6 w-6" />
          </div>
          <Button asChild variant="outline">
            <Link href="/admin/forms">View form inbox</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { totals, byType, latest } = forms;

  return (
    <div className={cn("grid gap-6 lg:grid-cols-2", className)}>
      <Card className="border border-border/40 bg-card/85 shadow-sm backdrop-blur-sm">
        <CardHeader className="space-y-2">
          <CardTitle>Recent Form Activity</CardTitle>
          <CardDescription>
            Distribution of incoming submissions by form type.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {byType.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/50 p-6 text-center text-sm text-muted-foreground">
              No form submissions captured yet. New activity will appear here
              automatically.
            </div>
          )}
          {byType.slice(0, 6).map((item, index) => {
            const completion = totals.overall
              ? Math.min(100, Math.round((item.total / totals.overall) * 100))
              : 0;

            return (
              <motion.div
                key={item.formType}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04, duration: 0.3 }}
                className="rounded-2xl border border-border/40 bg-background/80 p-4 shadow-xs"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {formatFormType(item.formType)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.total.toLocaleString()} submissions
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="rounded-full border-primary/40 bg-primary/10 text-xs font-medium text-primary"
                  >
                    {item.pending} pending
                  </Badge>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border/40">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary via-primary/80 to-primary/60"
                    style={{ width: `${completion}%` }}
                  />
                </div>
                {item.lastSubmittedAt && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Latest update: <RelativeTime date={item.lastSubmittedAt} />
                  </p>
                )}
              </motion.div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border border-border/40 bg-card/85 shadow-sm backdrop-blur-sm">
        <CardHeader className="space-y-2">
          <CardTitle>Recent Submissions</CardTitle>
          <CardDescription>
            Most recent form entries requiring admin attention.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {latest.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
              You&apos;re all caught up! New submissions will appear here
              instantly.
            </div>
          )}
          {latest.slice(0, latestLimit).map((submission, index) => {
            const attachmentsCount = submission.attachmentsCount ?? 0;

            return (
              <motion.div
                key={submission.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                className="relative overflow-hidden rounded-2xl border border-border/50 bg-background/80 p-4 shadow-xs transition hover:border-primary/30 hover:shadow-primary/10"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300 hover:opacity-100" />
                <div className="relative z-10 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="rounded-full bg-primary/15 text-xs font-semibold uppercase tracking-wider text-primary">
                        {formatFormType(submission.form_type ?? "unknown")}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={statusBadgeClass(submission.status)}
                      >
                        {submission.status ? submission.status : "New"}
                      </Badge>
                    </div>
                    {submission.submitted_at && (
                      <span className="text-xs text-muted-foreground">
                        <RelativeTime date={submission.submitted_at} />
                      </span>
                    )}
                  </div>

                  <div className="grid gap-2 text-xs text-muted-foreground md:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-foreground">
                        {submission.name ||
                          submission.company_name ||
                          "Anonymous"}
                      </p>
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5" />
                        <span className="truncate text-xs">
                          {submission.email}
                        </span>
                      </div>
                      {submission.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5" />
                          <span>{submission.phone}</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      {submission.company_name && (
                        <div className="flex items-center gap-2">
                          <Building className="h-3.5 w-3.5" />
                          <span>{submission.company_name}</span>
                        </div>
                      )}
                      {submission.city && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{submission.city}</span>
                        </div>
                      )}
                      {submission.message && (
                        <p className="line-clamp-2 text-xs text-muted-foreground/80">
                          {submission.message}
                        </p>
                      )}
                      {attachmentsCount > 0 && (
                        <div className="flex items-center gap-2">
                          <UploadCloud className="h-3.5 w-3.5" />
                          <span>
                            {attachmentsCount} attachment
                            {attachmentsCount === 1 ? "" : "s"}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/forms?submission=${submission.id}`}>
                        Review submission
                      </Link>
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
