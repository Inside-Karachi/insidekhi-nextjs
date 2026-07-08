"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "subtle" | "strong";
  animate?: boolean;
}

export function GlassPanel({
  children,
  className = "",
  variant = "default",
  animate = true,
}: GlassPanelProps) {
  const variants = {
    default: "bg-black/25 backdrop-blur-xl border border-white/25",
    subtle: "bg-black/15 backdrop-blur-lg border border-white/20",
    strong: "bg-black/35 backdrop-blur-xl border border-white/30",
  };

  const baseClassName = cn(
    "rounded-2xl shadow-2xl",
    variants[variant],
    // Shadow and glow effects
    "shadow-black/40 shadow-2xl",
    // Add subtle ring effect for depth
    "ring-1 ring-white/10",
    // Hover effects for interactive elements
    "transition-all duration-300",
    className,
  );

  const baseStyle = {
    // Backdrop filter for glass effect
    backdropFilter: "blur(24px) saturate(200%) contrast(120%)",
    WebkitBackdropFilter: "blur(24px) saturate(200%) contrast(120%)",
  };

  const content = (
    <>
      {/* Inner glow and gradient effects */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/20 via-white/5 to-transparent pointer-events-none" />
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/20 via-transparent to-white/10 pointer-events-none" />

      {/* Subtle inner border highlight */}
      <div className="absolute inset-[1px] rounded-2xl border border-white/20 pointer-events-none" />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </>
  );

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{
          duration: 0.6,
          ease: "easeOut",
        }}
        className={baseClassName}
        style={baseStyle}
      >
        {content}
      </motion.div>
    );
  }

  return (
    <div className={baseClassName} style={baseStyle}>
      {content}
    </div>
  );
}

// Specialized glass panels for different use cases
export function AuthFormPanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <GlassPanel
      variant="default"
      className={cn("p-8 max-w-md w-full mx-auto", className)}
    >
      {children}
    </GlassPanel>
  );
}

export function WelcomePanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <GlassPanel variant="subtle" className={cn("p-6 text-center", className)}>
      {children}
    </GlassPanel>
  );
}

export function StatsPanel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <GlassPanel variant="strong" className={cn("p-4", className)}>
      {children}
    </GlassPanel>
  );
}
