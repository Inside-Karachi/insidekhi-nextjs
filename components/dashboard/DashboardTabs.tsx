"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, Trophy, Calendar, Heart, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { name: "Home", href: "/dashboard", icon: LayoutDashboard },
  { name: "Achievements", href: "/dashboard/achievements", icon: Trophy },
  { name: "Bookings", href: "/dashboard/bookings", icon: Calendar },
  { name: "Favorites", href: "/dashboard/favorites", icon: Heart },
  { name: "Reviews", href: "/dashboard/reviews", icon: Star },
];

export function DashboardTabs() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-1 md:gap-2 overflow-x-auto pb-2 -mx-6 px-6 md:mx-0 md:px-0 scrollbar-hide">
      {TABS.map((tab) => {
        const isActive =
          tab.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(tab.href);
        const Icon = tab.icon;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors duration-200",
              isActive
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
            )}
          >
            {isActive && (
              <motion.div
                layoutId="dashboard-tab-active"
                className="absolute inset-0 bg-primary/10 border border-primary/20 rounded-xl"
                transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
              />
            )}
            <Icon className="h-4 w-4 relative z-10" />
            <span className="relative z-10">{tab.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
