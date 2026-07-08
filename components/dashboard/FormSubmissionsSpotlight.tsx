"use client";

import * as React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  Clock,
  Inbox,
  Mail,
  Phone,
  Building,
  MapPin,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RelativeTime } from "@/components/ui/RelativeTime";
import type { FormsOverviewData } from "@/types/form.types";

type FormSubmissionsSpotlightProps = {
  forms?: FormsOverviewData;
  className?: string;
  compact?: boolean;
};

function formatFormType(value: string) {
  return value
    .split(/[\s_-]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStatusBadgeClass(status: string | null) {
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

export function FormSubmissionsSpotlight({
  forms,
  className,
  compact = false,
}: FormSubmissionsSpotlightProps) {
  if (!forms) {
    return (
      <div
        className={cn(
          "rounded-2xl border border-dashed border-border/60 bg-background/60 p-8 text-center backdrop-blur-sm",
          className
        )}
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ClipboardList className="h-6 w-6" />
        </div>
        <h3 className="text-xl font-semibold">Form submissions</h3>
        <p className="mt-2 text-muted-foreground">
          Stay on top of membership, get-listed, and contact requests as soon as
          they arrive.
        </p>
        <Button asChild className="mt-6">
          <Link href="/admin/forms">
            View form inbox
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    );
  }

  const { totals, byType, latest } = forms;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        "relative overflow-hidden rounded-3xl border border-border/30 bg-gradient-to-br from-background/80 via-background/60 to-background/80 shadow-premium backdrop-blur-[18px]",
        className
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-primary/10" />
      <div className="absolute -top-32 -right-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute -bottom-40 -left-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative z-10 p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1 text-xs font-medium uppercase tracking-wider text-primary">
              <ClipboardList className="h-3.5 w-3.5" />
              Form Inbox Snapshot
            </div>
            <h2 className="mt-4 text-2xl font-bold sm:text-3xl">
              Recent submissions overview
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Monitor every touchpoint at a glance — membership, get-listed, and
              contact activity updates in real-time.
            </p>
          </div>
          {!compact && (
            <Button
              asChild
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90"
            >
              <Link href="/admin/forms">
                Open full inbox
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            {
              label: "Total submissions",
              icon: Inbox,
              value: totals.overall,
              accent:
                "from-primary/20 via-primary/10 to-primary/5 text-primary",
            },
            {
              label: "Awaiting review",
              icon: Clock,
              value: totals.pending,
              accent:
                "from-amber-500/20 via-amber-500/10 to-amber-500/5 text-amber-500",
            },
            {
              label: "Last 24 hours",
              icon: ClipboardList,
              value: totals.last24Hours,
              accent:
                "from-emerald-500/20 via-emerald-500/10 to-emerald-500/5 text-emerald-500",
            },
          ].map((card, index) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08, duration: 0.5 }}
              className={cn(
                "relative overflow-hidden rounded-2xl border border-border/40 bg-background/80 p-5 shadow-sm",
                "bg-gradient-to-br",
                card.accent
              )}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {card.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">
                    {card.value.toLocaleString()}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 text-current">
                  <card.icon className="h-6 w-6" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-2 space-y-4">
            <div>
              <h3 className="text-lg font-semibold">Submission mix</h3>
              <p className="text-sm text-muted-foreground">
                See which funnels are generating the most activity right now.
              </p>
            </div>
            <div className="space-y-3">
              {byType.length === 0 && (
                <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                  No forms captured yet. Once submissions start rolling in,
                  youll see the breakdown here.
                </div>
              )}
              {byType.map((item, index) => {
                const completion = totals.overall
                  ? Math.min(
                      100,
                      Math.round((item.total / totals.overall) * 100)
                    )
                  : 0;
                return (
                  <motion.div
                    key={item.formType}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.06, duration: 0.4 }}
                    className="rounded-2xl border border-border/40 bg-background/70 p-4 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
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
                        className="rounded-full border-primary/30 bg-primary/10 text-xs text-primary"
                      >
                        {item.pending} pending
                      </Badge>
                    </div>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-border/40">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${completion}%` }}
                        transition={{ delay: index * 0.08, duration: 0.4 }}
                        className="h-full rounded-full bg-gradient-to-r from-primary via-primary/80 to-primary/60"
                      />
                    </div>
                    {item.lastSubmittedAt && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Latest update:{" "}
                        <RelativeTime date={item.lastSubmittedAt} />
                      </p>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Latest submissions</h3>
                <p className="text-sm text-muted-foreground">
                  Quick snapshot of the most recent activity across all forms.
                </p>
              </div>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="hidden sm:inline-flex"
              >
                <Link href="/admin/forms">
                  Manage forms
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="space-y-3">
              {latest.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                  Youre all caught up! New submissions will appear here
                  instantly.
                </div>
              )}
              {latest.slice(0, compact ? 3 : 5).map((submission, index) => (
                <motion.div
                  key={submission.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08, duration: 0.45 }}
                  className="relative overflow-hidden rounded-2xl border border-border/50 bg-background/80 p-4 shadow-sm backdrop-blur-sm hover:border-primary/30 hover:shadow-primary/10"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 transition-opacity duration-300 hover:opacity-100" />
                  <div className="relative z-10">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Badge className="rounded-full bg-primary/15 text-xs font-semibold text-primary">
                          {formatFormType(submission.form_type)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full text-xs",
                            getStatusBadgeClass(submission.status)
                          )}
                        >
                          {submission.status ? submission.status : "New"}
                        </Badge>
                        {submission.attachmentsCount &&
                          submission.attachmentsCount > 0 && (
                            <div className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-background/60 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                              <ImageIcon className="h-3 w-3" />
                              {submission.attachmentsCount}
                            </div>
                          )}
                      </div>
                      {submission.submitted_at && (
                        <span className="text-xs text-muted-foreground">
                          <RelativeTime date={submission.submitted_at} />
                        </span>
                      )}
                    </div>

                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {submission.name ||
                            submission.company_name ||
                            "Unnamed submission"}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          <span className="truncate">{submission.email}</span>
                        </div>
                        {submission.phone && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            <span>{submission.phone}</span>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        {submission.company_name && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Building className="h-3.5 w-3.5" />
                            <span>{submission.company_name}</span>
                          </div>
                        )}
                        {submission.city && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>{submission.city}</span>
                          </div>
                        )}
                        {submission.message && (
                          <p className="line-clamp-2 text-xs text-muted-foreground/80">
                            {submission.message}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
