"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  Bell,
  CheckCheck,
  Filter,
  Inbox,
  Loader2,
  Mail,
  RefreshCcw,
  Search,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { NotificationItem } from "@/components/layout/notifications/NotificationItem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import FilterChip from "@/components/ui/FilterChip";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "@/hooks/useDebounce";
import { useNotificationsFeed } from "@/hooks/useNotificationsFeed";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type {
  NotificationFeedFilters,
  NotificationFeedItem,
  NotificationFeedStatusFilter,
  NotificationUserRole,
} from "@/types/notifications.types";

const STATUS_FILTERS: Array<{
  key: NotificationFeedStatusFilter;
  label: string;
  description: string;
}> = [
  {
    key: "all",
    label: "All",
    description: "Everything in your feed",
  },
  {
    key: "unread",
    label: "Unread",
    description: "Items you haven’t opened yet",
  },
  {
    key: "archived",
    label: "Archived",
    description: "Previously filed away",
  },
];

const CHANNEL_OPTIONS = [
  { key: "all", label: "All channels", icon: Sparkles },
  { key: "bell", label: "In-app", icon: Bell },
  { key: "email", label: "Email", icon: Mail },
  { key: "push", label: "Push", icon: Smartphone },
] as const;

const PRIORITY_OPTIONS = [
  { key: "all", label: "Any priority" },
  { key: "high", label: "High" },
  { key: "normal", label: "Normal" },
  { key: "low", label: "Low" },
] as const;

const isDefaultFilters = (filters: NotificationFeedFilters) =>
  (filters.status ?? "all") === "all" &&
  (filters.channel ?? "all") === "all" &&
  (filters.priority ?? "all") === "all" &&
  !(filters.includeArchived ?? false) &&
  !(filters.search && filters.search.trim().length);

const buildStatusChipDescription = (
  status: NotificationFeedStatusFilter
): string => {
  const meta = STATUS_FILTERS.find((option) => option.key === status);
  return meta?.description ?? "";
};

const ArchivedBadge = () => (
  <Badge className="rounded-lg bg-slate-500/20 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
    Archived
  </Badge>
);

const UnreadBadge = () => (
  <Badge className="rounded-lg bg-primary/10 text-[11px] font-semibold uppercase tracking-wide text-primary">
    Unread
  </Badge>
);

const ReadBadge = () => (
  <Badge className="rounded-lg bg-muted text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
    Read
  </Badge>
);

const CategoryBadge = ({ label }: { label: string }) => (
  <Badge
    variant="secondary"
    className="rounded-lg bg-accent/30 text-xs font-medium"
  >
    {label}
  </Badge>
);

const SkeletonCard = () => (
  <div className="space-y-3 rounded-3xl border border-border/60 bg-background/60 p-5">
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-2">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
        <div className="h-10 w-[280px] animate-pulse rounded bg-muted/70" />
      </div>
      <div className="h-3 w-20 animate-pulse rounded bg-muted" />
    </div>
    <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
      <div className="h-6 w-32 animate-pulse rounded bg-muted" />
      <div className="flex gap-2">
        <div className="h-9 w-24 animate-pulse rounded bg-muted" />
        <div className="h-9 w-24 animate-pulse rounded bg-muted" />
      </div>
    </div>
  </div>
);

export function PremiumNotificationsPage() {
  const router = useRouter();
  const feed = useNotificationsFeed({
    pageSize: 20,
    initialFilters: { status: "all" },
  });
  const { toast } = useToast();
  const { userId, user, isLoading: authLoading } = useSupabaseUser();

  const [searchValue, setSearchValue] = useState(feed.filters.search ?? "");
  const debouncedSearch = useDebounce(searchValue, 350);
  const [role, setRole] = useState<NotificationUserRole | null>(null);
  const [isRoleLoading, setIsRoleLoading] = useState(true);
  const [isSeeding, setIsSeeding] = useState(false);

  useEffect(() => {
    void feed.setFilters((prev) => ({ ...prev, search: debouncedSearch }));
  }, [debouncedSearch, feed]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!userId || !user) {
      setRole(null);
      setIsRoleLoading(false);
      return;
    }

    setRole((user.role as NotificationUserRole) ?? null);
    setIsRoleLoading(false);
  }, [authLoading, userId, user]);

  const activeStatus: NotificationFeedStatusFilter =
    feed.filters.status ?? "all";
  const activeChannel = feed.filters.channel ?? "all";
  const activePriority = feed.filters.priority ?? "all";

  const inViewCounts = useMemo(() => {
    const total = feed.items.length;
    let unread = 0;
    let archived = 0;
    feed.items.forEach((item) => {
      if (!item.readAt && !item.archivedAt) {
        unread += 1;
      }
      if (item.archivedAt) {
        archived += 1;
      }
    });
    return { total, unread, archived };
  }, [feed.items]);

  const onStatusChange = useCallback(
    (status: NotificationFeedStatusFilter) => {
      void feed.setFilters((prev) => ({
        ...prev,
        status,
        includeArchived: status === "archived",
      }));
    },
    [feed]
  );

  const onChannelChange = useCallback(
    (value: string) => {
      void feed.setFilters((prev) => ({
        ...prev,
        channel: value as typeof prev.channel,
      }));
    },
    [feed]
  );

  const onPriorityChange = useCallback(
    (value: string) => {
      void feed.setFilters((prev) => ({
        ...prev,
        priority: value as typeof prev.priority,
      }));
    },
    [feed]
  );

  const resetFilters = useCallback(() => {
    void feed.setFilters({
      status: "all",
      search: "",
      channel: "all",
      priority: "all",
    });
    setSearchValue("");
  }, [feed]);

  const handleOpenItem = useCallback(
    async (item: NotificationFeedItem) => {
      await feed.markAsRead(item.id);
      if (item.ctaUrl) {
        router.push(item.ctaUrl);
      }
    },
    [feed, router]
  );

  const handleArchive = useCallback(
    async (item: NotificationFeedItem) => {
      await feed.markAsRead(item.id, true);
    },
    [feed]
  );

  const handleMarkRead = useCallback(
    async (item: NotificationFeedItem) => {
      if (item.readAt && !item.archivedAt) {
        return;
      }
      await feed.markAsRead(item.id);
    },
    [feed]
  );

  const handleGenerateDemo = useCallback(async () => {
    if (isSeeding) {
      return;
    }
    setIsSeeding(true);
    try {
      const response = await fetch("/api/notifications/seed", {
        method: "POST",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? "Unable to generate notification");
      }

      toast({
        title: "Notification queued",
        description: "We generated a sample alert for your current role.",
      });
      await feed.refresh();
    } catch (error) {
      console.error("Failed to seed demo notification", error);
      toast({
        title: "Could not create sample",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while generating the notification.",
        variant: "destructive",
      });
    } finally {
      setIsSeeding(false);
    }
  }, [feed, isSeeding, toast]);

  const renderSummaryCard = (
    title: string,
    value: string,
    description: string,
    accentClass: string
  ) => (
    <div className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <p className={cn("mt-2 text-2xl font-bold", accentClass)}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );

  const isPristine = useMemo(
    () => isDefaultFilters(feed.filters),
    [feed.filters]
  );

  const isInitialLoading = !feed.isInitialized && feed.isLoading;
  const showSkeleton = isInitialLoading;

  const statusDescription = useMemo(
    () => buildStatusChipDescription(activeStatus),
    [activeStatus]
  );

  const hasItems = feed.items.length > 0;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-border/60 bg-gradient-to-br from-background via-background to-primary/5 p-6 shadow-xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Live notification feed
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                Stay ahead with instant alerts
              </h1>
              <p className="text-sm text-muted-foreground md:text-base">
                Review every alert, mark it complete, archive what’s done, and
                tap through to resolve outstanding tasks.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 font-medium">
                <Bell className="h-3.5 w-3.5" /> {feed.unreadCount} unread
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 font-medium">
                <Filter className="h-3.5 w-3.5" /> {statusDescription}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-3 md:w-64">
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-2xl"
              disabled={feed.isLoading}
              onClick={() => void feed.refresh()}
            >
              {feed.isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Refreshing
                </>
              ) : (
                <>
                  <RefreshCcw className="mr-2 h-4 w-4" /> Refresh feed
                </>
              )}
            </Button>
            <Button
              type="button"
              className="h-11 rounded-2xl"
              disabled={feed.unreadCount === 0 || feed.isMarkingAll}
              onClick={() => void feed.markAllAsRead()}
            >
              {feed.isMarkingAll ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Marking…
                </>
              ) : (
                <>
                  <CheckCheck className="mr-2 h-4 w-4" /> Mark all as read
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {renderSummaryCard(
            "Unread",
            String(feed.unreadCount),
            "Notifications awaiting your attention",
            "text-primary"
          )}
          {renderSummaryCard(
            "Visible",
            String(inViewCounts.total),
            "Entries in the current view",
            "text-foreground"
          )}
          {renderSummaryCard(
            "Archived in view",
            String(inViewCounts.archived),
            "Previously archived notifications",
            "text-muted-foreground"
          )}
        </div>
      </section>



      <section className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {STATUS_FILTERS.map((filter) => (
                <FilterChip
                  key={filter.key}
                  active={activeStatus === filter.key}
                  onClick={() => onStatusChange(filter.key)}
                  icon={
                    filter.key === "all"
                      ? Sparkles
                      : filter.key === "unread"
                      ? Bell
                      : Archive
                  }
                  isLast={filter.key === "archived"}
                >
                  {filter.label}
                </FilterChip>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{statusDescription}</p>
          </div>
          <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center">
            <div className="relative w-full lg:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search title, details, or category"
                className="h-11 rounded-2xl pl-10"
              />
            </div>
            <Select value={activeChannel} onValueChange={onChannelChange}>
              <SelectTrigger className="h-11 w-full rounded-2xl bg-background/80 lg:w-52">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border/60 bg-popover/95">
                {CHANNEL_OPTIONS.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    <div className="flex items-center gap-2">
                      <option.icon className="h-4 w-4" />
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={activePriority} onValueChange={onPriorityChange}>
              <SelectTrigger className="h-11 w-full rounded-2xl bg-background/80 lg:w-52">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent className="rounded-2xl border-border/60 bg-popover/95">
                {PRIORITY_OPTIONS.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!isPristine && (
              <Button
                type="button"
                variant="ghost"
                className="h-11 rounded-2xl"
                onClick={resetFilters}
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        {feed.error && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-rose-500/40 bg-rose-500/10 p-8 text-center">
            <Inbox className="h-10 w-10 text-rose-500" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">
                We couldn’t load your notifications
              </p>
              <p className="text-sm text-muted-foreground">
                Please refresh the page or try again in a moment.
              </p>
            </div>
            <Button type="button" onClick={() => void feed.refresh()}>
              <RefreshCcw className="mr-2 h-4 w-4" /> Try again
            </Button>
          </div>
        )}

        {!feed.error && showSkeleton && (
          <div className="grid gap-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        )}

        {!feed.error && !showSkeleton && !hasItems && (
          <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-border/60 bg-background/80 p-12 text-center">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">
                You’re all caught up!
              </h2>
              <p className="text-sm text-muted-foreground">
                New notifications will land here instantly. Tune your filters
                anytime to revisit archived alerts.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="rounded-2xl"
              onClick={() => void feed.refresh()}
            >
              <RefreshCcw className="mr-2 h-4 w-4" /> Refresh feed
            </Button>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {!feed.error && hasItems && (
            <motion.div
              layout
              className="grid gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {feed.items.map((item) => {
                const isProcessing = feed.markingIds.get(item.id) ?? false;
                const statusBadge = item.archivedAt ? (
                  <ArchivedBadge />
                ) : !item.readAt ? (
                  <UnreadBadge />
                ) : (
                  <ReadBadge />
                );

                return (
                  <motion.div
                    key={item.id}
                    layout
                    className="space-y-3 rounded-3xl border border-border/60 bg-background/70 p-5 shadow-sm transition-colors duration-150 hover:border-primary/40"
                  >
                    <NotificationItem
                      item={item}
                      isMarking={isProcessing}
                      onSelect={() => handleOpenItem(item)}
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {statusBadge}
                        {item.categoryLabel ? (
                          <CategoryBadge label={item.categoryLabel} />
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="rounded-xl"
                          disabled={isProcessing || Boolean(item.archivedAt)}
                          onClick={() => void handleArchive(item)}
                        >
                          <Archive className="mr-2 h-4 w-4" /> Archive
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          disabled={
                            isProcessing ||
                            (!item.archivedAt && Boolean(item.readAt))
                          }
                          onClick={() => void handleMarkRead(item)}
                        >
                          {isProcessing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCheck className="mr-2 h-4 w-4" />
                          )}
                          Mark read
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {feed.hasMore && (
          <div className="flex justify-center pt-2">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-w-[220px] rounded-2xl"
              disabled={feed.isLoadingMore}
              onClick={() => void feed.loadMore()}
            >
              {feed.isLoadingMore ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading
                  more…
                </>
              ) : (
                "Load more"
              )}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
