"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { PremiumToggleSwitchProps } from "@/types/filter.types";

const sizeConfig = {
  sm: {
    container: "h-8 px-3 text-xs",
    icon: "w-3 h-3",
    gap: "gap-1.5",
  },
  md: {
    container: "h-10 px-4 text-sm",
    icon: "w-4 h-4",
    gap: "gap-2",
  },
  lg: {
    container: "h-12 px-5 text-base",
    icon: "w-5 h-5",
    gap: "gap-2.5",
  },
};

const variantConfig = {
  default: {
    active: "bg-primary text-primary-foreground",
    inactive: "bg-muted text-muted-foreground",
    border: "border-border",
  },
  success: {
    active: "bg-green-500 text-white",
    inactive: "bg-muted text-muted-foreground",
    border: "border-border",
  },
  warning: {
    active: "bg-amber-500 text-white",
    inactive: "bg-muted text-muted-foreground",
    border: "border-border",
  },
};

export function PremiumToggleSwitch({
  checked,
  onChange,
  label,
  icon: Icon,
  variant = "default",
  size = "md",
  disabled = false,
  loading = false,
  className,
}: PremiumToggleSwitchProps) {
  const sizeStyles = sizeConfig[size];
  const variantStyles = variantConfig[variant];

  const handleClick = () => {
    if (!disabled && !loading) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      handleClick();
    }
  };

  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || loading}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative inline-flex items-center rounded-full border transition-all duration-200 ease-in-out",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        "cursor-pointer select-none font-medium",
        sizeStyles.container,
        sizeStyles.gap,
        checked ? variantStyles.active : variantStyles.inactive,
        variantStyles.border,
        disabled && "opacity-50 cursor-not-allowed",
        loading && "cursor-wait",
        className
      )}
      whileHover={!disabled && !loading ? { scale: 1.02 } : undefined}
      whileTap={!disabled && !loading ? { scale: 0.98 } : undefined}
    >
      <motion.div
        className="flex items-center"
        layout
        transition={{ duration: 0.2, ease: "easeInOut" }}
      >
        <motion.div
          className={cn(
            "flex items-center",
            sizeStyles.gap,
            checked ? "order-2" : "order-1"
          )}
          initial={false}
          animate={{ opacity: loading ? 0.7 : 1 }}
          transition={{ duration: 0.15 }}
        >
          <span className="whitespace-nowrap">{label}</span>
        </motion.div>

        <motion.div
          className={cn(
            "flex items-center justify-center",
            sizeStyles.icon,
            checked ? "order-1" : "order-2"
          )}
          initial={false}
          animate={{ rotate: checked ? 0 : 0, scale: loading ? 0.8 : 1 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
        >
          {loading ? (
            <motion.div
              className={cn(
                "border-2 border-current border-t-transparent rounded-full",
                sizeStyles.icon
              )}
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          ) : (
            <Icon className={sizeStyles.icon} />
          )}
        </motion.div>
      </motion.div>

      <motion.div
        className="absolute inset-0 rounded-full"
        initial={false}
        animate={{
          backgroundColor: checked
            ? "rgba(255, 255, 255, 0.1)"
            : "rgba(0, 0, 0, 0.05)",
        }}
        transition={{ duration: 0.2 }}
      />
    </motion.button>
  );
}

export default PremiumToggleSwitch;
