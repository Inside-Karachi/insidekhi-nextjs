"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "relative h-4 w-full overflow-hidden rounded-full",
      // Background with proper contrast for both modes
      "bg-muted dark:bg-black/30",
      // Border for definition
      "border border-border/50 dark:border-white/10",
      // Shadow for depth
      "shadow-inner shadow-black/30 dark:shadow-black/30",
      className,
    )}
    {...props}
  >
    <motion.div
      className={cn(
        "h-full rounded-full",
        // Gradient background
        "bg-gradient-to-r from-primary via-primary/90 to-primary",
        // Glow effect
        "shadow-lg shadow-primary/30",
        // Smooth transitions
        "transition-all duration-700 ease-out",
      )}
      initial={{ width: 0 }}
      animate={{ width: `${value || 0}%` }}
      transition={{
        duration: 1.2,
        ease: [0.4, 0, 0.2, 1],
        delay: 0.3,
      }}
      style={{
        // Additional glow
        filter: "drop-shadow(0 0 8px rgba(255, 24, 77, 0.4))",
      }}
    />

    {/* Shimmer effect */}
    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/10 dark:via-white/20 to-transparent animate-shimmer" />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
