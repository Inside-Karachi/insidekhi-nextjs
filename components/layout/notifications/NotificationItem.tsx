"use client";

import { memo, type KeyboardEvent, type ReactElement } from "react";
import { motion } from "framer-motion";
import { Bell, CheckCheck, Mail, Smartphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/ui/RelativeTime";
import { cn } from "@/lib/utils";
import type {
  NotificationDeliveryStatus,
  NotificationFeedItem,
  NotificationPriority,
} from "@/types/notifications.types";

export interface NotificationItemProps {
  item: NotificationFeedItem;
  isMarking?: boolean;
  onSelect: (item: NotificationFeedItem) => void | Promise<void>;
}

const priorityCopy: Record<
  NotificationPriority,
  { label: string; tone: string }
> = {
  low: { label: "Low", tone: "bg-muted text-muted-foreground" },
  normal: { label: "Normal", tone: "bg-muted text-muted-foreground" },
  high: {
    label: "High",
    tone: "bg-rose-500/15 text-rose-500 dark:text-rose-300",
  },
};

const channelMeta = {
  bell: { icon: Bell, label: "In-app" },
  email: { icon: Mail, label: "Email" },
  push: { icon: Smartphone, label: "Push" },
} as const;

const statusTone: Record<NotificationDeliveryStatus, string> = {
  sent: "bg-emerald-500/15 text-emerald-500 dark:text-emerald-300",
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  processing: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  failed: "bg-rose-500/15 text-rose-500 dark:text-rose-300",
};

function ChannelBadges({
  item,
}: {
  item: NotificationFeedItem;
}): ReactElement | null {
  if (!item.channels.length) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {item.channels.map((channel) => {
        const meta = channelMeta[channel.channel];
        const Icon = meta?.icon ?? Bell;

        // Only show badge for 'sent' status to avoid confusing users with technical statuses
        if (channel.status !== "sent") {
          return null;
        }

        return (
          <Badge
            key={channel.id}
            variant="secondary"
            className={cn(
              "inline-flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs font-medium",
              statusTone[channel.status] ?? "bg-muted text-muted-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{meta?.label ?? channel.channel}</span>
          </Badge>
        );
      })}
    </div>
  );
}

function CtaButton({
  item,
  onSelect,
  disabled,
}: {
  item: NotificationFeedItem;
  onSelect: (item: NotificationFeedItem) => void | Promise<void>;
  disabled?: boolean;
}): ReactElement | null {
  if (!item.ctaUrl) {
    return null;
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={disabled}
      className="h-9 rounded-xl border-border/60 bg-background/60 text-xs font-semibold hover:bg-primary/10 hover:text-primary"
      onClick={(event) => {
        event.stopPropagation();
        void onSelect(item);
      }}
    >
      <span>{item.ctaLabel ?? "Open"}</span>
    </Button>
  );
}

const NotificationItemComponent = ({
  item,
  onSelect,
  isMarking = false,
}: NotificationItemProps) => {
  const priority = priorityCopy[item.priority] ?? priorityCopy.normal;
  const unread = !item.readAt;

  const handleActivate = () => {
    if (isMarking) return;
    void onSelect(item);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isMarking) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleActivate();
    }
  };

  return (
    <motion.article
      role="button"
      tabIndex={isMarking ? -1 : 0}
      aria-disabled={isMarking}
      layout
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
      className={cn(
        "group w-full rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-left transition-all duration-200 hover:border-primary/40 hover:bg-primary/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-border/40",
        unread &&
          "border-primary/50 bg-primary/5 shadow-[0_0_20px_rgba(255,24,77,0.12)] hover:shadow-[0_0_26px_rgba(255,24,77,0.18)]",
        isMarking && "cursor-not-allowed opacity-80"
      )}
      data-disabled={isMarking ? "true" : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold leading-tight text-foreground">
              {item.title}
            </span>
            {priority && (
              <Badge
                variant="secondary"
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
                  priority.tone
                )}
              >
                {priority.label}
              </Badge>
            )}
          </div>
          {item.body && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {item.body}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <RelativeTime
            date={item.triggeredAt}
            className="text-xs font-medium text-muted-foreground"
          />
          {unread && (
            <motion.span
              layoutId="notification-pill"
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              New
            </motion.span>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <ChannelBadges item={item} />
        <CtaButton item={item} onSelect={onSelect} disabled={isMarking} />
      </div>
    </motion.article>
  );
};

export const NotificationItem = memo(NotificationItemComponent);
NotificationItem.displayName = "NotificationItem";
