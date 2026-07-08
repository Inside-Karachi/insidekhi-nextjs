"use client";

import { useCallback } from "react";
import { Loader2, RefreshCcw, Sparkles, Inbox } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { NotificationsFeedHandle } from "@/hooks/useNotificationsFeed";
import { NotificationItem } from "@/components/layout/notifications/NotificationItem";

interface NotificationsPanelProps {
    feed: NotificationsFeedHandle;
    variant: "desktop" | "mobile";
    onClose: () => void;
    className?: string; // Allow custom styling wrapper
}

export function NotificationsPanel({
    feed,
    variant,
    onClose,
    className,
}: NotificationsPanelProps) {
    const router = useRouter();

    const handleSelect = useCallback(
        async (itemId: string, ctaUrl?: string | null) => {
            await feed.markAsRead(itemId);
            onClose();
            if (ctaUrl) {
                router.push(ctaUrl);
            }
        },
        [feed, onClose, router]
    );

    const handleRefresh = useCallback(async () => {
        await feed.refresh();
    }, [feed]);

    const renderSkeleton = () => (
        <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
                <div
                    key={index}
                    className="space-y-3 rounded-2xl border border-border/50 bg-background/60 p-4"
                >
                    <div className="flex items-center justify-between gap-3">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton className="h-10 w-full" />
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-6 w-20" />
                        <Skeleton className="h-6 w-16" />
                    </div>
                </div>
            ))}
        </div>
    );

    const renderEmptyState = () => (
        <div className="flex flex-1 flex-col items-center justify-center space-y-4 py-10 text-center">
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">
                    You’re all caught up
                </p>
                <p className="text-sm text-muted-foreground">
                    New alerts will appear here instantly. Keep exploring Karachi!
                </p>
            </div>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                    void feed.refresh();
                }}
                className="rounded-xl"
            >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refresh feed
            </Button>
        </div>
    );

    const renderError = () => (
        <div className="flex flex-1 flex-col items-center justify-center space-y-4 py-10 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/15">
                <Inbox className="h-8 w-8 text-rose-500" />
            </div>
            <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">
                    We couldn’t load notifications
                </p>
                <p className="text-sm text-muted-foreground">
                    Please check your connection and try again.
                </p>
            </div>
            <Button
                type="button"
                onClick={() => void feed.refresh()}
                className="rounded-xl"
            >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Retry
            </Button>
        </div>
    );

    const content = () => {
        if (!feed.isInitialized && feed.isLoading) {
            return renderSkeleton();
        }

        if (feed.error) {
            return renderError();
        }

        if (!feed.items.length) {
            return renderEmptyState();
        }

        const itemsList = (
            <div className="space-y-3">
                {feed.items.map((item) => (
                    <NotificationItem
                        key={item.id}
                        item={item}
                        isMarking={feed.markingIds.get(item.id) ?? false}
                        onSelect={async (selected) => {
                            await handleSelect(selected.id, selected.ctaUrl);
                        }}
                    />
                ))}
                {feed.hasMore && (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full rounded-xl"
                        disabled={feed.isLoadingMore}
                        onClick={() => void feed.loadMore()}
                    >
                        {feed.isLoadingMore ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Loading more
                            </>
                        ) : (
                            "Load more"
                        )}
                    </Button>
                )}
            </div>
        );

        if (variant === "mobile") {
            // Native scrolling for mobile drawer - more reliable
            return (
                <div className="flex-1 overflow-y-auto scrollbar-thin pr-2">
                    {itemsList}
                </div>
            );
        }

        // Desktop gets the custom ScrollArea
        return (
            <div className="space-y-3">
                <ScrollArea className="h-[360px] pr-2">
                    {itemsList}
                </ScrollArea>
            </div>
        );
    };

    return (
        <div className={cn("flex h-full flex-col", className)}>
            {/* Header for desktop only - Mobile has it in the drawer */}
            {variant === "desktop" && (
                <>
                    <div className="flex items-center justify-between py-2">
                        <div className="space-y-1">
                            <p className="text-sm font-semibold text-foreground">
                                Notifications
                                {feed.unreadCount > 0 && (
                                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                                        {feed.unreadCount > 99 ? "99+" : feed.unreadCount} new
                                    </span>
                                )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Stay on top of updates.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-xl"
                                onClick={() => void handleRefresh()}
                                disabled={feed.isLoading}
                            >
                                <RefreshCcw
                                    className={cn("h-4 w-4", feed.isLoading && "animate-spin")}
                                />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="rounded-xl"
                                disabled={
                                    feed.unreadCount === 0 || feed.isMarkingAll || feed.isLoading
                                }
                                onClick={() => void feed.markAllAsRead()}
                            >
                                {feed.isMarkingAll ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    "Mark read"
                                )}
                            </Button>
                        </div>
                    </div>
                    <div className="my-3 h-px bg-border/60" />
                </>
            )}

            <div className="flex-1 min-h-0 flex flex-col">{content()}</div>

            {variant === "desktop" && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-muted/30 px-4 py-3">
                    <div className="space-y-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            History
                        </p>
                        <p className="text-sm text-muted-foreground">
                            View all notification history.
                        </p>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => {
                            onClose();
                            router.push("/dashboard/notifications");
                        }}
                    >
                        All
                    </Button>
                </div>
            )}
        </div>
    );
}
