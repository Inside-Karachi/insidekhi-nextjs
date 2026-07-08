"use client";

import { motion } from "framer-motion";
import React from "react";

interface LoaderBarProps {
  active: boolean;
}

/**
 * LoaderBar
 * A lightweight top progress indicator that appears
 * immediately on navigation start and disappears on completion.
 */
export default function LoaderBar({ active }: LoaderBarProps) {
  if (!active) return null;

  return (
    <div
      aria-live="polite"
      aria-busy={active}
      className="fixed top-0 left-0 right-0 z-[10000] pointer-events-none"
    >
      {/* Track */}
      <div className="relative h-[3px] sm:h-[4px] w-full bg-gradient-to-r from-primary/15 via-primary/10 to-primary/15">
        {/* Glow underlay for contrast on light/dark headers */}
        <div className="absolute inset-0 bg-primary/20 blur-[6px] opacity-60" />

        {/* Shimmer sweep (brand) */}
        <motion.div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(120deg, transparent 0%, rgba(var(--primary-rgb),0.3) 25%, rgba(var(--primary-rgb),0.6) 50%, rgba(var(--primary-rgb),0.3) 75%, transparent 100%)",
            backgroundSize: "200% 100%",
            maskImage:
              "linear-gradient(to right, transparent, black 20%, black 80%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 20%, black 80%, transparent)",
          }}
          animate={{ backgroundPositionX: ["0%", "-200%"] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
        />

        {/* Indeterminate bar (foreground) */}
        <motion.div
          className="relative h-full w-1/3 rounded-r-full shadow-[0_0_10px_rgba(0,0,0,0.15)]"
          style={{
            background:
              "linear-gradient(90deg, var(--primary) 0%, #ff184d 50%, var(--primary) 100%)",
            boxShadow:
              "0 0 12px rgba(var(--primary-rgb),0.55), 0 0 24px rgba(var(--primary-rgb),0.35)",
          }}
          initial={{ x: "-35%", opacity: 1 }}
          animate={{ x: ["-35%", "105%"], opacity: [1, 1, 1] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}
