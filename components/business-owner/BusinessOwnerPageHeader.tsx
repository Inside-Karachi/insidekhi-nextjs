"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

/** Matches dashboard pages like `PremiumFavoritesGrid`: icon tile, title, subtitle. Layout padding is provided by `PremiumDashboardLayout`. */
export function BusinessOwnerPageHeader({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      className={cn("mb-8", className)}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="shrink-0 p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
            <Icon className="h-7 w-7 text-primary" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-foreground tracking-tight">
              {title}
            </h1>
            {description ? (
              <p className="mt-1 text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {action ? (
          <div className="flex shrink-0 justify-start sm:justify-end sm:pt-1">
            {action}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

/** Surface for filters/toolbars. */
export const BUSINESS_OWNER_FILTER_BAR =
  "rounded-2xl border border-border/40 bg-background/60 backdrop-blur-sm p-4 shadow-sm";

/** Listing cards - glass panel consistent with dashboard favorites / bookings. */
export const BUSINESS_OWNER_CARD_SURFACE =
  "rounded-2xl border border-border/50 bg-background/70 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300";

/** Empty state panel - same language as `PremiumFavoritesGrid`. */
export const BUSINESS_OWNER_EMPTY_STATE =
  "rounded-2xl border border-border/40 bg-gradient-to-br from-primary/4 to-transparent p-10 text-center";
